import Test from '../models/Test.js';
import Result from '../models/Result.js';
import xlsx from 'xlsx';

export const importTest = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: '请上传试卷文件' });
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const questions = rows.map(row => ({
            seq: parseInt(row.seq || row['题号']),
            options: {
                A: row.optionA?.toString() || row['选项A']?.toString() || '',
                B: row.optionB?.toString() || row['选项B']?.toString() || '',
                C: row.optionC?.toString() || row['选项C']?.toString() || '',
                D: row.optionD?.toString() || row['选项D']?.toString() || ''
            },
            correctAnswer: (row.correctAnswer || row['正确答案'])?.toString().toUpperCase() || null
        }));

        const scoringRules = { firstTry: 3, secondTry: 2, thirdTry: 1 };
        const test = await Test.create({ status: 'draft', questions, scoringRules });
        res.status(200).json({ success: true, message: '试卷导入成功', testId: test._id });
    } catch (error) {
        res.status(500).json({ success: false, message: '文件解析失败: ' + error.message });
    }
};

export const publishTest = async (req, res) => {
    const { testId } = req.params;
    try {
        await Test.updateMany({ _id: { $ne: testId }, status: 'published' }, { $set: { status: 'closed' } });
        const test = await Test.findByIdAndUpdate(testId, { status: 'published' }, { new: true });
        req.app.get('io').emit('TEST_STARTED', { testId: test._id });
        res.json({ success: true, test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const nextQuestion = async (req, res) => {
    const { testId } = req.params;
    try {
        const test = await Test.findById(testId);
        if (test.currentQuestionSeq >= test.questions.length) {
            req.app.get('io').emit('ENTER_FEEDBACK', { testId });
            return res.json({ success: true, message: '已进入 Feedback 环节' });
        }
        test.currentQuestionSeq += 1;
        await test.save();
        req.app.get('io').emit('CHANGE_QUESTION', { testId, seq: test.currentQuestionSeq });
        res.json({ success: true, currentSeq: test.currentQuestionSeq });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const closeTest = async (req, res) => {
    const { testId } = req.params;
    try {
        await Test.findByIdAndUpdate(testId, { status: 'closed' });
        req.app.get('io').emit('TEST_ENDED', { testId });
        res.json({ success: true, message: '测试已结束' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTestList = async (req, res) => {
    try {
        const tests = await Test.find().select('_id status createdAt scoringRules currentQuestionSeq').sort({ createdAt: -1 }).lean();
        res.json({ success: true, tests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteTest = async (req, res) => {
    const { testId } = req.params;
    try {
        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: '未找到该试卷' });
        await Test.findByIdAndDelete(testId);
        await Result.deleteMany({ testId });
        res.json({ success: true, message: '测试及相关记录已成功删除' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};