import Test from '../models/Test.js';
import Team from '../models/Team.js';
import Result from '../models/Result.js';
import * as redisService from '../services/redisService.js';
import { calculateDistance } from '../utils/geo.js';

// ==========================================
// 👨‍🏫 教师端核心逻辑
// ==========================================

/**
 * 1. 教师上传更新 GPS 位置
 */
export const updateTeacherGPS = async (req, res) => {
    const { lat, lng } = req.body;
    await redisService.setTeacherGPS(lat, lng);
    res.json({ success: true, message: '教师位置已更新' });
};

/**
 * 2. 导入试题 (草稿状态)
 */
export const importTest = async (req, res) => {
    const { questions, scoringRules } = req.body;
    try {
        const test = await Test.create({
            status: 'draft',
            questions, // [{ seq: 1, options: {A: '..', B: '..', C: '..', D: '..'}, correctAnswer: 'A' }]
            scoringRules: scoringRules || { firstTry: 3, secondTry: 2, thirdTry: 1 }
        });
        res.json({ success: true, test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 3. 发布试卷
 */
export const publishTest = async (req, res) => {
    const { testId } = req.params;
    try {
        const test = await Test.findByIdAndUpdate(testId, { status: 'published' }, { new: true });
        
        // 【核心】通过 Socket 广播通知全体学生：试卷已下发！
        req.app.get('io').emit('TEST_STARTED', { testId: test._id });
        
        res.json({ success: true, test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 4. 教师切换下一题 / 进入 Feedback
 */
export const nextQuestion = async (req, res) => {
    const { testId } = req.params;
    try {
        const test = await Test.findById(testId);
        
        if (test.currentQuestionSeq >= test.questions.length) {
            // 已经是最后一题，再次点击触发 Feedback 环节
            req.app.get('io').emit('ENTER_FEEDBACK', { testId });
            return res.json({ success: true, message: '已进入 Feedback 环节' });
        }

        // 切换到下一题
        test.currentQuestionSeq += 1;
        await test.save();

        // 广播新题号，要求学生端重置状态、重新请求并重新抢锁
        req.app.get('io').emit('CHANGE_QUESTION', { testId, seq: test.currentQuestionSeq });
        
        res.json({ success: true, currentSeq: test.currentQuestionSeq });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 5. 结束测试
 */
export const closeTest = async (req, res) => {
    const { testId } = req.params;
    try {
        await Test.findByIdAndUpdate(testId, { status: 'closed' });
        
        // 广播结束指令，前端收到后强制路由回退到初始登录后的 /dashboard
        req.app.get('io').emit('TEST_ENDED', { testId });
        
        res.json({ success: true, message: '测试已结束' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// ==========================================
// 🎓 学生端核心逻辑
// ==========================================

/**
 * 6. 学生点击"开始测试" - 进行 GPS 时空校验与就位聚合
 */
export const checkLocationAndReady = async (req, res) => {
    const { teamId, studentId, lat, lng } = req.body;
    try {
        // A. 获取教师的 GPS 缓存
        const teacherGps = await redisService.getTeacherGPS();
        if (!teacherGps || !teacherGps.lat) {
            return res.status(400).json({ success: false, message: '教师尚未设定位置，请稍后' });
        }

        // B. 校验时间误差 (15分钟 = 900000ms)
        const timeDiff = Date.now() - parseInt(teacherGps.timestamp);
        if (timeDiff > 900000) {
            return res.status(400).json({ success: false, message: '教师位置已过期，请让教师刷新位置' });
        }

        // C. 校验距离误差 (500米以内)
        const distance = calculateDistance(lat, lng, parseFloat(teacherGps.lat), parseFloat(teacherGps.lng));
        if (distance > 500) {
            return res.status(400).json({ success: false, message: `距离过远 (${Math.round(distance)}米)，请靠近考场` });
        }

        // D. 校验通过，写入当前学生的 Ready 状态 (TTL 15分钟)
        await redisService.setStudentReady(teamId, studentId);

        // E. 聚合校验：全组是否都已 Ready？
        const team = await Team.findById(teamId).select('members').lean();
        const memberIds = team.members.map(id => id.toString());
        
        let allReady = true;
        for (const mId of memberIds) {
            const isReady = await redisService.checkStudentReady(teamId, mId);
            if (!isReady) {
                allReady = false;
                break;
            }
        }

        if (allReady) {
            res.json({ success: true, status: 'all_ready', message: '全员就位，允许进入测试' });
        } else {
            res.json({ success: true, status: 'waiting_members', message: '请确保所有组员到场' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 7. 学生获取题目内容 & 抢占设备锁 (刮刮乐机制前置)
 */
export const fetchQuestionData = async (req, res) => {
    const { testId, teamId, studentId } = req.query;

    try {
        const test = await Test.findById(testId).lean();
        if (test.status !== 'published') {
            return res.status(403).json({ success: false, message: '测试未发布或已结束' });
        }

        const currentQ = test.questions.find(q => q.seq === test.currentQuestionSeq);

        // A. 尝试获取该组当前题目的锁
        let activeStudent = await redisService.getActiveDevice(testId, teamId);
        
        // B. 如果没人抢到锁，当前学生尝试抢锁
        if (!activeStudent) {
            const locked = await redisService.acquireDeviceLock(testId, teamId, studentId);
            if (locked) activeStudent = studentId;
        }

        // C. 判断返回什么数据
        if (activeStudent === studentId) {
            // 抢到锁，或者锁就是自己的：返回完整选项
            res.json({ 
                success: true, 
                hasLock: true,
                question: { seq: currentQ.seq, options: currentQ.options } 
            });
        } else {
            // 别人抢到了锁：返回阉割版数据，并在 UI 显示提醒
            res.json({ 
                success: true, 
                hasLock: false, 
                message: '请与组内成员共享设备答题' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 8. 学生提交选项 (刮刮乐核心计分)
 */
export const submitAnswer = async (req, res) => {
    const { testId, teamId, studentId, seq, selectedOption } = req.body;
    
    try {
        // A. 防作弊：验证当前请求者是否真正拥有设备锁
        const activeStudent = await redisService.getActiveDevice(testId, teamId);
        if (activeStudent !== studentId) {
            return res.status(403).json({ success: false, message: '您不是当前答题设备' });
        }

        const test = await Test.findById(testId);
        const questionInfo = test.questions.find(q => q.seq === parseInt(seq));

        // B. 记录并获取尝试次数 (使用 Redis INCR 原子操作)
        // 假设 redisService 中有 incrementQuestionAttempts，如果没有请参照下方的补充
        const attempts = await redisService.incrementQuestionAttempts(testId, teamId, seq);
        
        let isCorrect = (selectedOption === questionInfo.correctAnswer);
        let scoreEarned = 0;
        let isExhausted = false;

        // C. 根据次数计算得分
        if (isCorrect) {
            if (attempts === 1) scoreEarned = test.scoringRules.firstTry;
            else if (attempts === 2) scoreEarned = test.scoringRules.secondTry;
            else if (attempts === 3) scoreEarned = test.scoringRules.thirdTry;
        } else {
            // 错了，判断是否是最后一次机会 (剩最后1个选项)
            if (attempts >= 3) {
                isExhausted = true; // 彻底错了
            }
        }

        // D. 终态记录 (答对 或 彻底答错)：存入 MongoDB Result 表
        if (isCorrect || isExhausted) {
            let resultDoc = await Result.findOne({ testId, teamId });
            if (!resultDoc) {
                resultDoc = new Result({ testId, teamId, activeStudentId: studentId, answers: [] });
            }
            
            // 检查这题是否已经记录过，防止重复计分
            const alreadyAnswered = resultDoc.answers.find(a => a.questionSeq === parseInt(seq));
            if (!alreadyAnswered) {
                resultDoc.answers.push({ questionSeq: seq, attempts, isCorrect });
                resultDoc.totalScore += scoreEarned;
                await resultDoc.save();
                
                // 答完一题后释放设备锁，以便下一题大家重新抢夺 (可选策略)
                await redisService.releaseDeviceLock(testId, teamId);
            }
        }

        res.json({
            success: true,
            isCorrect,
            isExhausted, // 前端如果收到 isExhausted=true，直接标红并显示正确答案
            scoreEarned,
            attempts,
            correctAnswer: isExhausted ? questionInfo.correctAnswer : null
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 9. 学生提交单题 Feedback
 */
export const submitFeedback = async (req, res) => {
    const { testId, teamId, studentId, seq, content } = req.body;
    try {
        let resultDoc = await Result.findOne({ testId, teamId });
        if (!resultDoc) {
            return res.status(404).json({ success: false, message: '尚未产生答题记录' });
        }
        
        resultDoc.feedback.push({ studentId, questionSeq: seq, content });
        await resultDoc.save();

        res.json({ success: true, message: '反馈提交成功' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 10. 教师获取某次测试的统计数据与 Feedback
 * GET /api/tests/:testId/statistics
 */
export const getTestStatistics = async (req, res) => {
    const { testId } = req.params;
    try {
        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: '未找到试卷' });

        // 获取该测试所有的答题结果，带上学生信息
        const results = await Result.find({ testId })
            .populate('feedback.studentId', 'name upi')
            .lean();

        // 初始化统计对象
        const stats = {};
        test.questions.forEach(q => {
            stats[q.seq] = { 
                firstTry: 0, secondTry: 0, thirdTry: 0, error: 0, 
                totalAttempts: 0, feedbacks: [] 
            };
        });

        // 遍历所有小组的结果进行数据聚合
        results.forEach(result => {
            // 聚合分数统计
            result.answers.forEach(ans => {
                const seq = ans.questionSeq;
                if (stats[seq]) {
                    stats[seq].totalAttempts += 1;
                    if (ans.isCorrect) {
                        if (ans.attempts === 1) stats[seq].firstTry += 1;
                        else if (ans.attempts === 2) stats[seq].secondTry += 1;
                        else if (ans.attempts === 3) stats[seq].thirdTry += 1;
                    } else {
                        // isCorrect 为 false 代表彻底答错
                        stats[seq].error += 1; 
                    }
                }
            });

            // 聚合 Feedback
            if (result.feedback && result.feedback.length > 0) {
                result.feedback.forEach(fb => {
                    if (stats[fb.questionSeq]) {
                        stats[fb.questionSeq].feedbacks.push({
                            studentName: fb.studentId?.name || '未知',
                            upi: fb.studentId?.upi || '未知',
                            content: fb.content
                        });
                    }
                });
            }
        });

        // 计算百分比
        Object.keys(stats).forEach(seq => {
            const qStat = stats[seq];
            const total = qStat.totalAttempts || 1; // 防除0
            qStat.rates = {
                firstTry: ((qStat.firstTry / total) * 100).toFixed(2) + '%',
                secondTry: ((qStat.secondTry / total) * 100).toFixed(2) + '%',
                thirdTry: ((qStat.thirdTry / total) * 100).toFixed(2) + '%',
                error: ((qStat.error / total) * 100).toFixed(2) + '%'
            };
        });

        res.json({ success: true, statistics: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 11. 教师导出某次测试的成绩表 (CSV格式)
 * GET /api/tests/:testId/export
 */
export const exportTestResults = async (req, res) => {
    const { testId } = req.params;
    try {
        const results = await Result.find({ testId })
            .populate('teamId', 'teamName')
            .populate('activeStudentId', 'name upi')
            .lean();

        // 构建 CSV 表头 (零依赖原生实现)
        let csvContent = '\uFEFF'; // 添加 BOM 头，防止 Excel 打开中文乱码
        csvContent += 'Team Name,Active Student Name,Student UPI,Total Score,Completed At\n';

        // 填充数据
        results.forEach(r => {
            const teamName = r.teamId?.teamName || 'N/A';
            const studentName = r.activeStudentId?.name || 'N/A';
            const upi = r.activeStudentId?.upi || 'N/A';
            const score = r.totalScore || 0;
            const date = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : 'N/A';
            
            // 处理包含逗号的字符串（CSV转义规则）
            csvContent += `"${teamName}","${studentName}","${upi}",${score},"${date}"\n`;
        });

        // 设置下载 Header，直接触发浏览器下载文件
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="test_results_${testId}.csv"`);
        
        res.status(200).send(csvContent);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};