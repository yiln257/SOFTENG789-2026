import Test from '../models/Test.js';
import Team from '../models/Team.js';
import Result from '../models/Result.js';
import User from '../models/User.js';
import * as redisService from '../services/redisService.js';
import { calculateDistance } from '../utils/geo.js';

export const checkLocationAndReady = async (req, res) => {
    const { teamId, lat, lng } = req.body;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) return res.status(401).json({ success: false, message: '无法识别身份，请重新登录' });

    try {
        const teacherGps = await redisService.getTeacherGPS();
        if (!teacherGps || !teacherGps.lat) {
            return res.status(400).json({ success: false, message: '教师尚未设定位置，请稍后' });
        }

        const timeDiff = Date.now() - parseInt(teacherGps.timestamp);
        if (timeDiff > 900000) {
            return res.status(400).json({ success: false, message: '教师位置已过期，请让教师刷新位置' });
        }

        const activeTest = await Test.findOne({ status: { $nin: ['draft', 'closed'] } }).sort({ createdAt: -1 });
        const isPublished = !!activeTest;
        const currentTestId = activeTest ? activeTest._id : null;

        const distance = calculateDistance(lat, lng, parseFloat(teacherGps.lat), parseFloat(teacherGps.lng));
        
        // ==========================================
        // 🚫 失败逻辑：0 次数据库操作！直接打回并提示重试
        // ==========================================
        if (distance > 500) {
            return res.status(400).json({ 
                success: false, 
                status: 'gps_failed', 
                message: `距离过远 (${Math.round(distance)}米)。若在教室内，请等待几秒让 GPS 稳定后再次点击。` 
            });
        }

        // ==========================================
        // ✨ 成功逻辑：写入白名单 (presentMembers)
        // ==========================================
        if (currentTestId) {
            await Result.findOneAndUpdate(
                { testId: currentTestId, teamId: teamId },
                { 
                    $addToSet: { presentMembers: studentId }, // 🚨 成功进场者记录在案
                    $setOnInsert: { answers: [], totalScore: 0 } 
                },
                { upsert: true, new: true }
            );
        }

        // ==========================================
        // 🔒 设备锁抢占与就绪逻辑
        // ==========================================
        await redisService.setStudentReady(teamId, studentId);

        const team = await Team.findById(teamId).select('members').lean();
        if (!team) return res.status(404).json({ success: false, message: '未找到队伍信息' });
        
        const memberIds = team.members.map(id => id.toString());
        const readyMembers = [];

        for (const mId of memberIds) {
            const isReady = await redisService.checkStudentReady(teamId, mId);
            if (isReady) readyMembers.push(mId);
        }

        if (readyMembers.length > 0 && currentTestId) {
            const existingOperator = await redisService.getActiveDevice(currentTestId, teamId);
            
            if (!existingOperator) {
                const randomIndex = Math.floor(Math.random() * readyMembers.length);
                const randomStudentId = readyMembers[randomIndex];
                
                await redisService.acquireDeviceLock(currentTestId, teamId, randomStudentId);
                console.log(`🎯 [动态锁分配] 已在 ${readyMembers.length} 名达标组员中，指派 [${randomStudentId}] 获得设备锁`);
            }
        }

        const io = req.app.get('io');
        if (io && currentTestId) { 
            io.to(`team_${teamId}`).emit('TEAM_ALL_READY', { testId: currentTestId });
        }

        return res.json({ 
            success: true, 
            status: 'all_ready', 
            message: 'GPS校验通过，准许进入测试', 
            testPublished: isPublished, 
            testId: currentTestId 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const fetchQuestionData = async (req, res) => {
    const { testId, teamId } = { ...req.params, ...req.query };
    const studentId = req.user?.id || req.user?._id;
    
    if (!studentId) return res.status(401).json({ success: false, message: '无法识别学生身份，请重新登录' });

    try {
        const test = await Test.findById(testId).lean();
        if (!test || test.status !== 'published') return res.status(403).json({ success: false, message: '测试未发布或已结束' });

        const currentQ = test.questions.find(q => q.seq === test.currentQuestionSeq);
        if (!currentQ) return res.status(404).json({ success: false, message: '未找到当前题目的数据' });

        // 1. 先查 Redis，看看有没有人拿过锁（通常在 checkLocationAndReady 时就已经分配了）
        let activeStudent = await redisService.getActiveDevice(testId, teamId);
        
        // 2. ✨ 防并发兜底逻辑：如果锁丢了，大家一起抢
        if (!activeStudent) {
            // 调用 acquireDeviceLock (内部是 SETNX，返回 true 表示我抢到了，false 表示没抢到)
            const acquired = await redisService.acquireDeviceLock(testId, teamId, studentId);
            
            if (acquired) {
                // 幸运儿：真正抢到了 Redis 锁
                activeStudent = studentId; 
            } else {
                // 慢半拍的人：没抢到，说明就在这几毫秒内，别人抢走了。重新去库里读一下真正的霸主是谁
                activeStudent = await redisService.getActiveDevice(testId, teamId);
            }
        }

        // 3. 严格的字符串比对判定
        const isOperator = activeStudent && activeStudent.toString() === studentId.toString();
        
        return res.json({ 
            success: true, 
            isOperator, 
            currentSeq: test.currentQuestionSeq, 
            question: { seq: currentQ.seq, options: currentQ.options } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const submitAnswer = async (req, res) => {
    const { testId, teamId, studentId, seq, selectedOption } = req.body;
    try {
        const activeStudent = await redisService.getActiveDevice(testId, teamId);
        if (activeStudent !== studentId) {
            return res.status(403).json({ success: false, message: '您不是当前答题设备' });
        }

        const test = await Test.findById(testId);
        
        // 🚨 漏洞修复：如果测试状态不是进行中(published)，严禁后续任何分数写入！
        if (!test || test.status !== 'published') {
            return res.status(403).json({ success: false, message: '本次测试已由教师关闭，停止接收答案' });
        }

        const questionInfo = test.questions.find(q => q.seq === parseInt(seq));
        const attempts = await redisService.incrementQuestionAttempts(testId, teamId, seq);
        let isCorrect = (selectedOption === questionInfo.correctAnswer);
        let scoreEarned = 0;
        let isExhausted = false;

        // ✨ 明确且稳固的计分规则：1次3分，2次2分，3次1分，最后0分
        if (isCorrect) {
            if (attempts === 1) scoreEarned = 3;
            else if (attempts === 2) scoreEarned = 2;
            else if (attempts === 3) scoreEarned = 1;
        } else if (attempts >= 3) { 
            isExhausted = true; 
        }

        if (isCorrect || isExhausted) {
            let resultDoc = await Result.findOne({ testId, teamId });
            if (!resultDoc) {
                resultDoc = new Result({ testId, teamId, activeStudentId: studentId, answers: [] });
            } else if (!resultDoc.activeStudentId) {
                resultDoc.activeStudentId = studentId;
            }
            
            const alreadyAnswered = resultDoc.answers.find(a => a.questionSeq === parseInt(seq));
            if (!alreadyAnswered) {
                resultDoc.answers.push({ questionSeq: seq, attempts, isCorrect });
                resultDoc.totalScore += scoreEarned;
                await resultDoc.save();
                await redisService.releaseDeviceLock(testId, teamId);
            }
        }
        
        res.json({ success: true, isCorrect, isExhausted, scoreEarned, attempts, correctAnswer: isExhausted ? questionInfo.correctAnswer : null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const submitFeedback = async (req, res) => {
    const { testId, feedback } = req.body;
    const studentId = req.user?.id || req.user?._id; // 从认证中间件中安全提取身份

    if (!studentId || !feedback?.trim()) {
        return res.status(400).json({ success: false, message: '缺少必要参数或反馈内容为空' });
    }

    try {
        // ✨ 高性能：直接去 User 表捞取当前提交者的真实姓名和 UPI
        const studentInfo = await User.findById(studentId).select('name upi').lean();
        
        // 📢 实时 Socket 广播给教师端
        const io = req.app.get('io');
        if (io) {
            // 向全局或专门的测试房间推送
            io.emit('NEW_FEEDBACK_RECEIVED', {
                testId,
                studentId,
                name: studentInfo?.name || '未知学生',
                upi: studentInfo?.upi || 'N/A',
                content: feedback,
                timestamp: new Date()
            });
        }

        // 仅响应成功，不包含任何让前端跳转的指令
        res.json({ success: true, message: '反馈提交成功' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};