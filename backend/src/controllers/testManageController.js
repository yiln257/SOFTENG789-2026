import Test from '../models/Test.js';
import Result from '../models/Result.js';
import Team from '../models/Team.js';
import User from '../models/User.js';
import CheckIn from '../models/CheckIn.js';
import xlsx from 'xlsx';

const FEEDBACK_WINDOW_MS = 10 * 60 * 1000;

const getCell = (row, keys, fallback = '') => {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return fallback;
};

const dissolveTeams = async (filter) => {
    const teams = await Team.find(filter).select('_id').lean();
    const teamIds = teams.map((team) => team._id);

    if (teamIds.length === 0) return;

    await User.updateMany({ teamId: { $in: teamIds } }, { $set: { teamId: null } });
    await Team.updateMany({ _id: { $in: teamIds } }, { $set: { isActive: false } });
};

const removeTeams = async (filter) => {
    const teams = await Team.find(filter).select('_id').lean();
    const teamIds = teams.map((team) => team._id);

    if (teamIds.length === 0) return 0;

    await User.updateMany({ teamId: { $in: teamIds } }, { $set: { teamId: null } });
    const deleteResult = await Team.deleteMany({ _id: { $in: teamIds } });
    return deleteResult.deletedCount;
};

const finishTest = async (testId, io) => {
    const feedbackOpenUntil = new Date(Date.now() + FEEDBACK_WINDOW_MS);
    const test = await Test.findByIdAndUpdate(
        testId,
        { status: 'closed', feedbackOpenUntil },
        { new: true }
    );

    await dissolveTeams({ testId, isActive: true });

    if (io) {
        io.emit('TEST_ENDED', {
            testId,
            feedbackOpenUntil,
            message: 'The test has ended.'
        });
    }

    return test;
};

export const importTest = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a test file.' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const questions = rows.map((row, index) => ({
            seq: parseInt(getCell(row, ['seq', 'Seq', 'Question', 'Question No', '题号'], index + 1), 10),
            options: {
                A: getCell(row, ['optionA', 'Option A', 'A', '选项A']).toString(),
                B: getCell(row, ['optionB', 'Option B', 'B', '选项B']).toString(),
                C: getCell(row, ['optionC', 'Option C', 'C', '选项C']).toString(),
                D: getCell(row, ['optionD', 'Option D', 'D', '选项D']).toString()
            },
            correctAnswer: getCell(row, ['correctAnswer', 'Correct Answer', 'Answer', '正确答案'], null)?.toString().trim().toUpperCase() || null
        })).filter((question) => (
            Number.isFinite(question.seq)
            && question.options.A
            && question.options.B
            && question.options.C
            && question.options.D
        ));

        if (questions.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid questions were found in the file.' });
        }

        const test = await Test.create({
            status: 'draft',
            questions,
            scoringRules: { firstTry: 3, secondTry: 2, thirdTry: 1 },
            currentQuestionSeq: questions[0].seq || 1
        });

        res.status(200).json({ success: true, message: 'Test imported successfully.', testId: test._id });
    } catch (error) {
        res.status(500).json({ success: false, message: `File parsing failed: ${error.message}` });
    }
};

export const publishTest = async (req, res) => {
    const { testId } = req.params;

    try {
        const existingPublished = await Test.find({ _id: { $ne: testId }, status: 'published' }).select('_id');
        for (const test of existingPublished) {
            await finishTest(test._id, req.app.get('io'));
        }

        const test = await Test.findByIdAndUpdate(
            testId,
            {
                status: 'published',
                currentQuestionSeq: 1,
                feedbackOpenUntil: null
            },
            { new: true }
        );

        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        await Team.updateMany({ isActive: true, testId: null }, { $set: { testId: test._id } });

        req.app.get('io')?.emit('TEST_STARTED', {
            testId: test._id,
            currentSeq: test.currentQuestionSeq,
            totalQuestions: test.questions.length
        });

        res.json({ success: true, test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const nextQuestion = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }
        if (test.status !== 'published') {
            return res.status(400).json({ success: false, message: 'Only a published test can move questions.' });
        }

        const totalQuestions = test.questions.length;
        if (test.currentQuestionSeq >= totalQuestions) {
            const closedTest = await finishTest(testId, req.app.get('io'));
            return res.json({
                success: true,
                ended: true,
                message: 'The final question has been completed. The test is now closed.',
                test: closedTest
            });
        }

        test.currentQuestionSeq += 1;
        await test.save();

        req.app.get('io')?.emit('CHANGE_QUESTION', {
            testId,
            seq: test.currentQuestionSeq,
            currentSeq: test.currentQuestionSeq,
            totalQuestions
        });

        res.json({
            success: true,
            ended: false,
            currentSeq: test.currentQuestionSeq,
            totalQuestions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const closeTest = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }
        if (test.status === 'closed') {
            return res.json({ success: true, message: 'The test is already closed.', test });
        }

        const closedTest = await finishTest(testId, req.app.get('io'));
        res.json({ success: true, message: 'The test has ended.', test: closedTest });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTestList = async (req, res) => {
    try {
        const tests = await Test.find()
            .select('_id status createdAt currentQuestionSeq questions feedbackOpenUntil')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            tests: tests.map((test) => ({
                _id: test._id,
                status: test.status,
                createdAt: test.createdAt,
                currentQuestionSeq: test.currentQuestionSeq,
                questionCount: test.questions?.length || 0,
                feedbackOpenUntil: test.feedbackOpenUntil
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTestDetail = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId).lean();
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        res.json({
            success: true,
            test: {
                _id: test._id,
                status: test.status,
                createdAt: test.createdAt,
                currentQuestionSeq: test.currentQuestionSeq,
                questionCount: test.questions?.length || 0,
                feedbackOpenUntil: test.feedbackOpenUntil
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteTest = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        if (test.status === 'published') {
            return res.status(400).json({ success: false, message: 'Live tests cannot be deleted. End the test first.' });
        }

        const [resultDelete, checkInDelete, removedTeams] = await Promise.all([
            Result.deleteMany({ testId }),
            CheckIn.deleteMany({ testId }),
            removeTeams({ testId })
        ]);
        await Test.findByIdAndDelete(testId);

        res.json({
            success: true,
            message: `Test record deleted. Removed ${resultDelete.deletedCount} result records, ${checkInDelete.deletedCount} check-in records, and ${removedTeams} teams.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteTestResults = async (req, res) => {
    const { testId } = req.params;

    try {
        const test = await Test.findById(testId);
        if (!test) {
            const [resultDelete, checkInDelete] = await Promise.all([
                Result.deleteMany({ testId }),
                CheckIn.deleteMany({ testId })
            ]);
            return res.json({
                success: true,
                message: `The test record no longer exists. Cleared ${resultDelete.deletedCount} result records and ${checkInDelete.deletedCount} check-in records.`
            });
        }
        if (test.status === 'published') {
            return res.status(400).json({ success: false, message: 'Results cannot be deleted while the test is live.' });
        }

        const [resultDelete, checkInDelete] = await Promise.all([
            Result.deleteMany({ testId }),
            CheckIn.deleteMany({ testId })
        ]);

        res.json({
            success: true,
            message: `Deleted ${resultDelete.deletedCount} result records and ${checkInDelete.deletedCount} check-in records.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
