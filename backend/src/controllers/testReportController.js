import xlsx from 'xlsx';
import Team from '../models/Team.js';
import Test from '../models/Test.js';
import Result from '../models/Result.js';

export const getTestStatistics = async (req, res) => {
    const { testId } = req.params;
    try {
        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: '未找到试卷' });

        const results = await Result.find({ testId }).populate('feedback.studentId', 'name upi').lean();
        const stats = {};
        test.questions.forEach(q => {
            stats[q.seq] = { firstTry: 0, secondTry: 0, thirdTry: 0, error: 0, totalAttempts: 0, feedbacks: [] };
        });

        results.forEach(result => {
            result.answers.forEach(ans => {
                const seq = ans.questionSeq;
                if (stats[seq]) {
                    stats[seq].totalAttempts += 1;
                    if (ans.isCorrect) {
                        if (ans.attempts === 1) stats[seq].firstTry += 1;
                        else if (ans.attempts === 2) stats[seq].secondTry += 1;
                        else if (ans.attempts === 3) stats[seq].thirdTry += 1;
                    } else { stats[seq].error += 1; }
                }
            });

            if (result.feedback && result.feedback.length > 0) {
                result.feedback.forEach(fb => {
                    if (stats[fb.questionSeq]) {
                        stats[fb.questionSeq].feedbacks.push({
                            studentName: fb.studentId?.name || '未知', upi: fb.studentId?.upi || '未知', content: fb.content
                        });
                    }
                });
            }
        });

        Object.keys(stats).forEach(seq => {
            const qStat = stats[seq];
            const total = qStat.totalAttempts || 1;
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

export const exportTestResults = async (req, res) => {
    const { testId } = req.params;
    try {
        // 1. 获取所有队伍及组内所有成员的信息（这是全班大名单）
        const teams = await Team.find().populate('members', 'name upi').lean();
        
        // 2. 获取本次测试产生的所有结果文档
        const results = await Result.find({ testId }).lean();
        
        // 3. 将结果转化为字典 (Map) 以便快速查找。Key 为 teamId
        const resultMap = {};
        results.forEach(r => {
            resultMap[r.teamId.toString()] = {
                totalScore: r.totalScore || 0,
                // 把白名单内的学生 ID 转为字符串数组，方便后面做比对
                presentMembers: (r.presentMembers || []).map(id => id.toString()) 
            };
        });

        // 4. 构建要导出到 Excel 的数据数组
        const exportData = [];
        
        teams.forEach(team => {
            // 拿到这个队伍的成绩和白名单
            const teamResult = resultMap[team._id.toString()];
            const teamScore = teamResult ? teamResult.totalScore : 0;
            const presentIds = teamResult ? teamResult.presentMembers : [];

            // 遍历组内每一个学生
            team.members.forEach(student => {
                // 💡 核心计分逻辑：如果该学生在白名单内，拿小组得分；不在白名单（没来或失败），得 0 分
                const studentScore = presentIds.includes(student._id.toString()) ? teamScore : 0;
                
                exportData.push({
                    '学生姓名': student.name,
                    'UPI': student.upi,
                    '组名': team.teamName,
                    '个人成绩': studentScore
                });
            });
        });

        // 5. 使用 xlsx 库将 JSON 数组转成 Excel (XLSX) 文件流
        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "学生成绩表");
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // 6. 返回真正的 xlsx 附件给前端下载
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="test_results_${testId}.xlsx"`);
        res.status(200).send(buffer);

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};