import Test from '../models/Test.js';
import Team from '../models/Team.js';
import Result from '../models/Result.js';
import User from '../models/User.js';
import CheckIn from '../models/CheckIn.js';
import * as redisService from '../services/redisService.js';
import { calculateDistance } from '../utils/geo.js';
import crypto from 'crypto';

const CHECK_IN_RADIUS_METERS = 500;
const TEACHER_GPS_TTL_MS = 15 * 60 * 1000;
const TEAM_MIN_SIZE = 3;
const TEAM_MAX_SIZE = 4;
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

const teamPopulation = [
    { path: 'members', select: 'name upi' },
    { path: 'leaderId', select: 'name upi' }
];

const getActivePublishedTest = () => {
    return Test.findOne({ status: 'published' }).sort({ createdAt: -1 });
};

const getOpenFeedbackTest = () => {
    return Test.findOne({
        status: 'closed',
        feedbackOpenUntil: { $gt: new Date() }
    }).sort({ feedbackOpenUntil: -1 });
};

const serializeTest = (test) => {
    if (!test) return null;
    return {
        id: test._id,
        status: test.status,
        currentSeq: test.currentQuestionSeq,
        totalQuestions: test.questions?.length || 0,
        feedbackOpenUntil: test.feedbackOpenUntil || null
    };
};

const serializeTeacherGpsStatus = (teacherGps) => {
    const timestamp = Number.parseInt(teacherGps?.timestamp, 10);
    const hasPosition = Boolean(teacherGps?.lat && teacherGps?.lng);
    const hasFreshTimestamp = Number.isFinite(timestamp) && Date.now() - timestamp <= TEACHER_GPS_TTL_MS;
    const remainingMs = Number.isFinite(timestamp)
        ? Math.max(0, timestamp + TEACHER_GPS_TTL_MS - Date.now())
        : 0;
    const isReady = hasPosition && hasFreshTimestamp;

    return {
        isSet: hasPosition,
        isReady,
        status: isReady ? 'ready' : hasPosition ? 'expired' : 'missing',
        updatedAt: Number.isFinite(timestamp) ? new Date(timestamp) : null,
        expiresAt: Number.isFinite(timestamp) ? new Date(timestamp + TEACHER_GPS_TTL_MS) : null,
        remainingSeconds: Math.ceil(remainingMs / 1000)
    };
};

const getTeacherGpsTimestamp = (teacherGps) => teacherGps?.timestamp?.toString() || null;

const getTeacherGpsForLobby = async () => {
    try {
        return await redisService.getTeacherGPS();
    } catch (error) {
        console.warn('Unable to read teacher GPS for lobby:', error.message);
        return null;
    }
};

const serializeTeam = (team, studentId) => {
    if (!team) return null;
    const doc = typeof team.toObject === 'function' ? team.toObject() : team;
    const leaderId = doc.leaderId?._id || doc.leaderId;
    const memberCount = doc.members?.length || 0;
    return {
        ...doc,
        memberCount,
        isReady: memberCount >= TEAM_MIN_SIZE && memberCount <= TEAM_MAX_SIZE,
        isLeader: leaderId?.toString() === studentId.toString()
    };
};

const getTeacherGpsWindow = (teacherGps) => {
    const timestamp = Number.parseInt(teacherGps?.timestamp, 10);
    const hasPosition = Boolean(teacherGps?.lat && teacherGps?.lng);
    const hasFreshTimestamp = Number.isFinite(timestamp) && Date.now() - timestamp <= TEACHER_GPS_TTL_MS;

    return {
        timestamp: Number.isFinite(timestamp) ? teacherGps.timestamp.toString() : null,
        isReady: hasPosition && hasFreshTimestamp
    };
};

const cleanupPendingCheckInsForGpsWindow = async (teacherGps) => {
    const gpsWindow = getTeacherGpsWindow(teacherGps);

    if (!gpsWindow.isReady || !gpsWindow.timestamp) {
        await CheckIn.deleteMany({ testId: null });
        return gpsWindow;
    }

    await CheckIn.deleteMany({
        testId: null,
        teacherGpsTimestamp: { $ne: gpsWindow.timestamp }
    });

    return gpsWindow;
};

const getStableOptionOrder = (testId, teamId, questionSeq) => {
    return [...OPTION_KEYS].sort((left, right) => {
        const leftHash = crypto
            .createHash('sha256')
            .update(`${testId}:${teamId}:${questionSeq}:${left}`)
            .digest('hex');
        const rightHash = crypto
            .createHash('sha256')
            .update(`${testId}:${teamId}:${questionSeq}:${right}`)
            .digest('hex');
        return leftHash.localeCompare(rightHash);
    });
};

const getTeamQuestionOptions = (question, testId, teamId) => {
    const originalOrder = getStableOptionOrder(testId, teamId, question.seq);
    const displayToOriginal = {};
    const options = {};
    let correctDisplayAnswer = null;

    OPTION_KEYS.forEach((displayKey, index) => {
        const originalKey = originalOrder[index];
        displayToOriginal[displayKey] = originalKey;
        options[displayKey] = question.options[originalKey];

        if (originalKey === question.correctAnswer) {
            correctDisplayAnswer = displayKey;
        }
    });

    return { options, displayToOriginal, correctDisplayAnswer };
};

const getAnswerStateForQuestion = async (testId, teamId, seq) => {
    const savedState = await redisService.getQuestionAnswerState(testId, teamId, seq);
    if (savedState) return savedState;

    return {
        seq: parseInt(seq, 10),
        attempts: await redisService.getQuestionAttempts(testId, teamId, seq),
        optionStates: {},
        isLocked: false,
        message: ''
    };
};

const buildAnswerState = ({ seq, attempts, selectedOption, previousState, isCorrect, isExhausted, scoreEarned }) => {
    const optionStates = { ...(previousState?.optionStates || {}) };

    if (isCorrect) {
        optionStates[selectedOption] = 'correct';
    } else {
        optionStates[selectedOption] = 'wrong';
    }

    let message = 'Incorrect. Please try again.';
    if (isCorrect) {
        message = `Correct. Score earned: ${scoreEarned}. Wait for the next question.`;
    } else if (isExhausted) {
        message = 'No attempts left. Wait for the next question.';
    }

    return {
        seq: parseInt(seq, 10),
        attempts,
        optionStates,
        isLocked: isCorrect || isExhausted,
        message
    };
};

const addPassedMemberToResult = async (testId, teamId, studentId) => {
    if (!testId || !teamId || !studentId) return;

    const team = await Team.findById(teamId).select('members').lean();
    if (!team || team.members.length < TEAM_MIN_SIZE || team.members.length > TEAM_MAX_SIZE) return;

    await Result.updateOne(
        { testId, teamId },
        { $addToSet: { presentMembers: studentId } }
    );
};

const getPassedMemberIds = async (testId, members) => {
    const memberIds = members.map((member) => member?._id || member).filter(Boolean);
    const passed = await CheckIn.find({
        testId,
        studentId: { $in: memberIds },
        status: 'passed'
    }).select('studentId').lean();

    return passed.map((record) => record.studentId);
};

const hasPassedCheckInForTest = async (testId, studentId) => {
    const currentCheckIn = await CheckIn.findOne({
        testId,
        studentId
    }).select('status').lean();
    if (currentCheckIn) {
        return currentCheckIn.status === 'passed';
    }

    const teacherGps = await redisService.getTeacherGPS();
    const gpsWindow = await cleanupPendingCheckInsForGpsWindow(teacherGps);
    if (!gpsWindow.isReady || !gpsWindow.timestamp) return false;

    const preTestCheckIn = await CheckIn.exists({
        testId: null,
        studentId,
        status: 'passed',
        teacherGpsTimestamp: gpsWindow.timestamp
    });
    return Boolean(preTestCheckIn);
};

const consumePreTestCheckInsForTeam = async (testId, team) => {
    const teacherGps = await redisService.getTeacherGPS();
    const gpsWindow = await cleanupPendingCheckInsForGpsWindow(teacherGps);
    if (!gpsWindow.isReady || !gpsWindow.timestamp) return;

    const memberIds = team.members.map((member) => member?._id || member).filter(Boolean);
    const preTestCheckIns = await CheckIn.find({
        testId: null,
        studentId: { $in: memberIds },
        status: 'passed',
        teacherGpsTimestamp: gpsWindow.timestamp
    }).lean();

    if (preTestCheckIns.length === 0) return;

    await CheckIn.bulkWrite(preTestCheckIns.map((checkIn) => ({
        updateOne: {
            filter: { testId, studentId: checkIn.studentId },
            update: {
                $set: {
                    status: 'passed',
                    distanceMeters: checkIn.distanceMeters,
                    checkedAt: checkIn.checkedAt,
                    teacherGpsTimestamp: checkIn.teacherGpsTimestamp || null
                }
            },
            upsert: true
        }
    })));

    await CheckIn.deleteMany({ _id: { $in: preTestCheckIns.map((checkIn) => checkIn._id) } });
};

const ensureResultForStartedTeam = async (testId, team, leaderId) => {
    const presentMembers = await getPassedMemberIds(testId, team.members);

    await Result.findOneAndUpdate(
        { testId, teamId: team._id },
        {
            $setOnInsert: {
                activeStudentId: leaderId,
                answers: [],
                totalScore: 0
            },
            $addToSet: {
                presentMembers: { $each: presentMembers }
            }
        },
        { upsert: true, new: true }
    );
};

export const getLobbyStatus = async (req, res) => {
    const studentId = req.user.id;

    try {
        const [student, activeTest, feedbackTest, teacherGps] = await Promise.all([
            User.findById(studentId).populate({
                path: 'teamId',
                match: { isActive: true },
                populate: teamPopulation
            }),
            getActivePublishedTest(),
            getOpenFeedbackTest(),
            getTeacherGpsForLobby()
        ]);

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }

        const gpsWindow = await cleanupPendingCheckInsForGpsWindow(teacherGps);
        let checkIn = null;
        if (activeTest) {
            checkIn = await CheckIn.findOne({ testId: activeTest._id, studentId }).lean()
                || (gpsWindow.isReady && gpsWindow.timestamp
                    ? await CheckIn.findOne({
                        testId: null,
                        studentId,
                        status: 'passed',
                        teacherGpsTimestamp: gpsWindow.timestamp
                    }).lean()
                    : null);
        } else {
            checkIn = gpsWindow.isReady && gpsWindow.timestamp
                ? await CheckIn.findOne({
                    testId: null,
                    studentId,
                    teacherGpsTimestamp: gpsWindow.timestamp
                }).lean()
                : null;
        }

        const effectiveFeedbackTest = activeTest ? null : feedbackTest;
        let feedbackSubmitted = false;

        if (effectiveFeedbackTest) {
            const submittedFeedback = await Result.exists({
                testId: effectiveFeedbackTest._id,
                'feedback.studentId': studentId
            });
            feedbackSubmitted = !!submittedFeedback;
        }

        return res.json({
            success: true,
            activeTest: serializeTest(activeTest),
            teacherGps: serializeTeacherGpsStatus(teacherGps),
            team: serializeTeam(student.teamId, studentId),
            checkIn: checkIn
                ? {
                    status: checkIn.status,
                    distanceMeters: checkIn.distanceMeters,
                    checkedAt: checkIn.checkedAt,
                    isPending: !checkIn.testId
                }
                : null,
            feedback: effectiveFeedbackTest
                ? {
                    available: true,
                    testId: effectiveFeedbackTest._id,
                    closesAt: effectiveFeedbackTest.feedbackOpenUntil,
                    submitted: feedbackSubmitted
                }
                : { available: false, submitted: false },
            now: new Date()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const checkLocationAndReady = async (req, res) => {
    const { lat, lng } = req.body;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
        return res.status(401).json({ success: false, message: 'Unable to identify the current student.' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ success: false, message: 'A valid GPS position is required.' });
    }

    try {
        const teacherGps = await redisService.getTeacherGPS();
        if (!teacherGps?.lat || !teacherGps?.lng) {
            await cleanupPendingCheckInsForGpsWindow(teacherGps);
            return res.status(400).json({ success: false, message: 'The teacher has not set the classroom GPS point yet.' });
        }

        const gpsWindow = await cleanupPendingCheckInsForGpsWindow(teacherGps);
        if (!gpsWindow.isReady) {
            return res.status(400).json({ success: false, message: 'The teacher GPS point has expired. Please ask the teacher to refresh it.' });
        }
        const teacherGpsTimestamp = gpsWindow.timestamp;

        const activeTest = await getActivePublishedTest();
        const distance = calculateDistance(
            latitude,
            longitude,
            parseFloat(teacherGps.lat),
            parseFloat(teacherGps.lng)
        );

        const existingCheckIn = activeTest
            ? await CheckIn.findOne({ testId: activeTest._id, studentId })
            : null;

        if (existingCheckIn?.status === 'passed') {
            return res.json({
                success: true,
                status: 'passed',
                message: 'Check-in already completed for this test.',
                distanceMeters: Math.round(existingCheckIn.distanceMeters || distance),
                testPublished: !!activeTest,
                testId: activeTest?._id || null
            });
        }

        if (distance > CHECK_IN_RADIUS_METERS) {
            if (activeTest && existingCheckIn?.status !== 'passed') {
                await CheckIn.findOneAndUpdate(
                    { testId: activeTest._id, studentId },
                    {
                        status: 'failed',
                        distanceMeters: Math.round(distance),
                        checkedAt: new Date(),
                        teacherGpsTimestamp
                    },
                    { upsert: true, new: true }
                );
            } else if (!activeTest) {
                await CheckIn.findOneAndUpdate(
                    { testId: null, studentId },
                    {
                        status: 'failed',
                        distanceMeters: Math.round(distance),
                        checkedAt: new Date(),
                        teacherGpsTimestamp
                    },
                    { upsert: true, new: true }
                );
            }

            return res.json({
                success: true,
                status: 'failed',
                message: `Check-in failed. You are ${Math.round(distance)} meters from the classroom point. Your score for this test is 0.`,
                distanceMeters: Math.round(distance),
                testPublished: !!activeTest,
                testId: activeTest?._id || null
            });
        }

        const passedCheckIn = {
            status: 'passed',
            distanceMeters: Math.round(distance),
            checkedAt: new Date(),
            teacherGpsTimestamp
        };

        if (activeTest) {
            await CheckIn.findOneAndUpdate(
                { testId: activeTest._id, studentId },
                passedCheckIn,
                { upsert: true, new: true }
            );

            const student = await User.findById(studentId).select('teamId').lean();
            if (student?.teamId) {
                await addPassedMemberToResult(activeTest._id, student.teamId, studentId);
            }
        } else {
            await CheckIn.findOneAndUpdate(
                { testId: null, studentId },
                passedCheckIn,
                { upsert: true, new: true }
            );
        }

        return res.json({
            success: true,
            status: 'passed',
            message: 'Check-in successful.',
            distanceMeters: Math.round(distance),
            testPublished: !!activeTest,
            testId: activeTest?._id || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const fetchQuestionData = async (req, res) => {
    const { testId, teamId } = { ...req.params, ...req.query };
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
        return res.status(401).json({ success: false, message: 'Unable to identify the current student.' });
    }

    try {
        const [test, team] = await Promise.all([
            Test.findById(testId).lean(),
            Team.findById(teamId).populate(teamPopulation)
        ]);

        if (!test || test.status !== 'published') {
            return res.status(403).json({ success: false, message: 'The test is not currently published.' });
        }

        if (!team || !team.isActive) {
            return res.status(404).json({ success: false, message: 'Your team is no longer active.' });
        }

        if (team.members.length < TEAM_MIN_SIZE || team.members.length > TEAM_MAX_SIZE) {
            return res.status(403).json({ success: false, message: 'Your team must have 3 to 4 students before starting the test.' });
        }

        const memberIds = team.members.map((member) => member._id.toString());
        if (!memberIds.includes(studentId.toString())) {
            return res.status(403).json({ success: false, message: 'You are not a member of this team.' });
        }

        const hasPassedCheckIn = await hasPassedCheckInForTest(testId, studentId);
        if (!hasPassedCheckIn) {
            return res.status(403).json({ success: false, message: 'GPS check-in is required before entering the test.' });
        }

        const currentQuestion = test.questions.find((question) => question.seq === test.currentQuestionSeq);
        if (!currentQuestion) {
            return res.status(404).json({ success: false, message: 'Current question data was not found.' });
        }

        const leaderId = team.leaderId?._id || team.leaderId;
        const isOperator = leaderId.toString() === studentId.toString();
        if (isOperator) {
            if (!team.lockedAt) {
                team.lockedAt = new Date();
                await team.save();
            }
            await consumePreTestCheckInsForTeam(testId, team);
            await ensureResultForStartedTeam(testId, team, leaderId);
        }

        const shuffledQuestion = getTeamQuestionOptions(currentQuestion, testId, teamId);
        const answerState = await getAnswerStateForQuestion(testId, teamId, test.currentQuestionSeq);

        return res.json({
            success: true,
            isOperator,
            currentSeq: test.currentQuestionSeq,
            totalQuestions: test.questions.length,
            question: {
                seq: currentQuestion.seq,
                options: shuffledQuestion.options
            },
            answerState,
            team: serializeTeam(team, studentId)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const submitAnswer = async (req, res) => {
    const { testId, teamId, seq, selectedOption } = req.body;
    const studentId = req.user?.id || req.user?._id;

    try {
        const [test, team] = await Promise.all([
            Test.findById(testId),
            Team.findById(teamId)
        ]);

        if (!test || test.status !== 'published') {
            return res.status(403).json({ success: false, message: 'This test is no longer accepting answers.' });
        }

        if (!team || !team.isActive) {
            return res.status(404).json({ success: false, message: 'Your team is no longer active.' });
        }

        if (team.members.length < TEAM_MIN_SIZE || team.members.length > TEAM_MAX_SIZE) {
            return res.status(403).json({ success: false, message: 'Your team must have 3 to 4 students before submitting answers.' });
        }

        const leaderId = team.leaderId.toString();
        if (leaderId !== studentId.toString()) {
            return res.status(403).json({ success: false, message: 'Only the team leader device can submit answers.' });
        }

        const hasPassedCheckIn = await hasPassedCheckInForTest(testId, studentId);
        if (!hasPassedCheckIn) {
            return res.status(403).json({ success: false, message: 'GPS check-in is required before submitting answers.' });
        }

        if (!team.lockedAt) {
            team.lockedAt = new Date();
            await team.save();
        }
        await consumePreTestCheckInsForTeam(testId, team);
        await ensureResultForStartedTeam(testId, team, team.leaderId);

        if (!['A', 'B', 'C', 'D'].includes(selectedOption)) {
            return res.status(400).json({ success: false, message: 'Selected option must be A, B, C, or D.' });
        }

        const questionInfo = test.questions.find((question) => question.seq === parseInt(seq, 10));
        if (!questionInfo) {
            return res.status(404).json({ success: false, message: 'Question not found.' });
        }
        const shuffledQuestion = getTeamQuestionOptions(questionInfo, testId, teamId);
        const originalSelectedOption = shuffledQuestion.displayToOriginal[selectedOption];

        if (!originalSelectedOption) {
            return res.status(400).json({ success: false, message: 'Selected option must be A, B, C, or D.' });
        }

        let resultDoc = await Result.findOne({ testId, teamId });
        if (resultDoc?.answers.some((answer) => answer.questionSeq === parseInt(seq, 10))) {
            return res.status(409).json({ success: false, message: 'This question has already been finalized for your team.' });
        }

        const previousAnswerState = await redisService.getQuestionAnswerState(testId, teamId, seq);
        const attempts = await redisService.incrementQuestionAttempts(testId, teamId, seq);
        const isCorrect = originalSelectedOption === questionInfo.correctAnswer;
        const isExhausted = !isCorrect && attempts >= 3;
        let scoreEarned = 0;

        if (isCorrect) {
            if (attempts === 1) scoreEarned = test.scoringRules.firstTry;
            else if (attempts === 2) scoreEarned = test.scoringRules.secondTry;
            else if (attempts === 3) scoreEarned = test.scoringRules.thirdTry;
        }

        if (isCorrect || isExhausted) {
            if (!resultDoc) {
                const presentMembers = await getPassedMemberIds(testId, team.members);
                resultDoc = new Result({
                    testId,
                    teamId,
                    activeStudentId: studentId,
                    answers: [],
                    presentMembers
                });
            } else if (!resultDoc.activeStudentId) {
                resultDoc.activeStudentId = studentId;
            }

            resultDoc.answers.push({
                questionSeq: parseInt(seq, 10),
                attempts,
                isCorrect
            });
            resultDoc.totalScore += scoreEarned;
            await resultDoc.save();
        }

        const answerState = buildAnswerState({
            seq,
            attempts,
            selectedOption,
            previousState: previousAnswerState,
            isCorrect,
            isExhausted,
            scoreEarned
        });

        await redisService.setQuestionAnswerState(testId, teamId, seq, answerState);

        req.app.get('io')?.to(`team_${teamId}`).emit('TEAM_ANSWER_UPDATED', {
            testId,
            teamId,
            seq: parseInt(seq, 10),
            answerState
        });

        res.json({
            success: true,
            isCorrect,
            isExhausted,
            scoreEarned,
            attempts,
            answerState
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const submitFeedback = async (req, res) => {
    const { testId, feedback } = req.body;
    const studentId = req.user?.id || req.user?._id;

    if (!studentId || !feedback?.trim()) {
        return res.status(400).json({ success: false, message: 'Feedback cannot be empty.' });
    }

    try {
        const test = await Test.findById(testId);
        if (!test || test.status !== 'closed') {
            return res.status(403).json({ success: false, message: 'Feedback is available only after a completed test.' });
        }

        if (!test.feedbackOpenUntil || test.feedbackOpenUntil.getTime() < Date.now()) {
            return res.status(403).json({ success: false, message: 'The feedback window has closed.' });
        }

        const activeTest = await getActivePublishedTest();
        if (activeTest) {
            return res.status(403).json({ success: false, message: 'Feedback is closed because a new test is live.' });
        }

        const existingFeedback = await Result.exists({
            testId,
            'feedback.studentId': studentId
        });
        if (existingFeedback) {
            return res.status(409).json({ success: false, message: 'Feedback has already been submitted for this test.' });
        }

        const team = await Team.findOne({ testId, members: studentId }).sort({ createdAt: -1 });
        if (!team) {
            return res.status(404).json({ success: false, message: 'No team record was found for this test.' });
        }

        const studentInfo = await User.findById(studentId).select('name upi').lean();
        const cleanFeedback = feedback.trim();

        await Result.findOneAndUpdate(
            { testId, teamId: team._id },
            {
                $setOnInsert: {
                    activeStudentId: team.leaderId,
                    answers: [],
                    totalScore: 0
                },
                $push: {
                    feedback: {
                        studentId,
                        content: cleanFeedback,
                        submittedAt: new Date()
                    }
                }
            },
            { upsert: true, new: true }
        );

        const io = req.app.get('io');
        if (io) {
            io.to('teacher_room').emit('NEW_FEEDBACK_RECEIVED', {
                testId,
                studentId,
                name: studentInfo?.name || 'Unknown student',
                upi: studentInfo?.upi || 'N/A',
                content: cleanFeedback,
                timestamp: new Date()
            });
        }

        res.json({ success: true, message: 'Feedback submitted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
