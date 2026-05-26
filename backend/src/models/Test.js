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
        default: null
    }
}, { _id: false });

const testSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Untitled Test'
    },
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
    },
    feedbackOpenUntil: {
        type: Date,
        default: null
    }
}, { timestamps: true });

testSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Test', testSchema);
