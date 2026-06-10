import xlsx from 'xlsx';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Test from '../models/Test.js';
import Result from '../models/Result.js';
import CheckIn from '../models/CheckIn.js';

const percent = (value, total) => {
    if (!total) return '0.00%';
    return `${((value / total) * 100).toFixed(2)}%`;
};

const getTeamDisplayId = (team) => team?.teamId || 'Unknown team';

const getIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const getSafeFileName = (value) => {
    return (value || 'Untitled Test')
        .toString()
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        || 'Untitled_Test';
};

export const getTestStatistics = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId).lean();
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        const [results, teams, checkIns, totalStudents] = await Promise.all([
            Result.find({ testId })
                .populate('activeStudentId', 'name upi')
                .populate('feedback.studentId', 'name upi')
                .lean(),
            Team.find({ testId }).populate('members', 'name upi').populate('leaderId', 'name upi').lean(),
            CheckIn.find({ testId }).populate('studentId', 'name upi').lean(),
            User.countDocuments({ role: 'student' })
        ]);

        const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));
        const questionStats = test.questions.map((question) => ({
            seq: question.seq,
            options: question.options,
            correctAnswer: question.correctAnswer,
            firstTry: 0,
            secondTry: 0,
            thirdTry: 0,
            incorrect: 0,
            totalFinalized: 0,
            rates: {
                firstTry: '0.00%',
                secondTry: '0.00%',
                thirdTry: '0.00%',
                incorrect: '0.00%'
            }
        }));
        const questionMap = new Map(questionStats.map((question) => [question.seq, question]));
        const resultByTeam = new Map(results.map((result) => [result.teamId.toString(), result]));
        const passedStudentIds = new Set(
            checkIns
                .filter((item) => item.status === 'passed')
                .map((item) => getIdString(item.studentId))
                .filter(Boolean)
        );
        const getPresentCount = (team, result) => {
            const presentIds = new Set(
                (result?.presentMembers || [])
                    .map((memberId) => getIdString(memberId))
                    .filter(Boolean)
            );

            team?.members?.forEach((member) => {
                const memberId = getIdString(member);
                if (passedStudentIds.has(memberId)) {
                    presentIds.add(memberId);
                }
            });

            return presentIds.size;
        };

        const feedbacks = [];
        results.forEach((result) => {
            result.answers?.forEach((answer) => {
                const question = questionMap.get(answer.questionSeq);
                if (!question) return;

                question.totalFinalized += 1;
                if (answer.isCorrect) {
                    if (answer.attempts === 1) question.firstTry += 1;
                    else if (answer.attempts === 2) question.secondTry += 1;
                    else if (answer.attempts === 3) question.thirdTry += 1;
                } else {
                    question.incorrect += 1;
                }
            });

            result.feedback?.forEach((item) => {
                feedbacks.push({
                    studentName: item.studentId?.name || 'Unknown student',
                    upi: item.studentId?.upi || 'N/A',
                    content: item.content,
                    submittedAt: item.submittedAt
                });
            });
        });

        const teamResults = teams.map((team) => {
            const result = resultByTeam.get(team._id.toString());
            return {
                teamObjectId: team._id,
                teamId: getTeamDisplayId(team),
                leader: team.leaderId || null,
                members: team.members || [],
                totalScore: result?.totalScore || 0,
                answeredQuestions: result?.answers?.length || 0,
                presentCount: getPresentCount(team, result)
            };
        });

        results.forEach((result) => {
            if (teamMap.has(result.teamId.toString())) return;

            teamResults.push({
                teamObjectId: result.teamId,
                teamId: 'Unknown team',
                leader: null,
                members: [],
                totalScore: result.totalScore || 0,
                answeredQuestions: result.answers?.length || 0,
                presentCount: result.presentMembers?.length || 0
            });
        });

        questionStats.forEach((question) => {
            question.rates = {
                firstTry: percent(question.firstTry, question.totalFinalized),
                secondTry: percent(question.secondTry, question.totalFinalized),
                thirdTry: percent(question.thirdTry, question.totalFinalized),
                incorrect: percent(question.incorrect, question.totalFinalized)
            };
        });

        const checkInCounts = checkIns.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
        }, { passed: 0, failed: 0 });
        checkInCounts.missing = Math.max(totalStudents - checkInCounts.passed - checkInCounts.failed, 0);

        res.json({
            success: true,
            statistics: {
                test: {
                    id: test._id,
                    name: test.name || 'Untitled Test',
                    status: test.status,
                    questionCount: test.questions.length,
                    currentQuestionSeq: test.currentQuestionSeq,
                    feedbackOpenUntil: test.feedbackOpenUntil
                },
                overview: {
                    totalTeams: teams.length,
                    totalStudents,
                    checkInCounts
                },
                questions: questionStats,
                teamResults,
                feedbacks
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const exportTestResults = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId).lean();
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        const [students, teams, results, checkIns] = await Promise.all([
            User.find({ role: 'student' }).select('name upi').sort({ upi: 1 }).lean(),
            Team.find({ testId }).populate('members', 'name upi').lean(),
            Result.find({ testId }).lean(),
            CheckIn.find({ testId }).lean()
        ]);

        const resultByTeam = new Map(results.map((result) => [result.teamId.toString(), result]));
        const checkInByStudent = new Map(checkIns.map((item) => [item.studentId.toString(), item]));
        const teamByStudent = new Map();

        teams.forEach((team) => {
            team.members.forEach((student) => {
                teamByStudent.set(student._id.toString(), team);
            });
        });

        const exportData = students.map((student) => {
            const studentId = student._id.toString();
            const team = teamByStudent.get(studentId);
            const result = team ? resultByTeam.get(team._id.toString()) : null;
            const checkIn = checkInByStudent.get(studentId);
            const checkInStatus = checkIn?.status || 'missing';
            const score = checkInStatus === 'passed' && result ? result.totalScore || 0 : 0;

            return {
                Name: student.name,
                UPI: student.upi,
                'Team ID': team ? getTeamDisplayId(team) : 'No team',
                'Check-in': checkInStatus,
                Score: score
            };
        });

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Student Results');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const fileName = `test_results_${getSafeFileName(test.name)}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
