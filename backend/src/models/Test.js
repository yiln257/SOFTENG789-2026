import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    seq: { type: Number, required: true },
    options: {
        A: { type: String, required: true },
        B: { type: String, required: true },
        C: { type: String, required: true },
        D: { type: String, required: true }
    },
    correctAnswer: { 
        type: String, 
        enum: ['A', 'B', 'C', 'D'],
        default: null // 导入时可能没有，由教师后续配置
    }
}, { _id: false }); // 子文档不需要独立的 _id

const testSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['draft', 'published', 'closed'],
        default: 'draft'
    },
    scoringRules: {
        firstTry: { type: Number, default: 3 },
        secondTry: { type: Number, default: 2 },
        thirdTry: { type: Number, default: 1 }
    },
    questions: [questionSchema],
    currentQuestionSeq: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

export default mongoose.model('Test', testSchema);