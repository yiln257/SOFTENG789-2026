import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
    questionSeq: { type: Number, required: true },
    attempts: { type: Number, required: true, min: 1, max: 4 },
    isCorrect: { type: Boolean, required: true }
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionSeq: { type: Number, required: true },
    content: { type: String, required: true }
}, { _id: false });

const resultSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    activeStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    totalScore: { type: Number, default: 0 },
    answers: [answerSchema],
    feedback: [feedbackSchema],

    // 💡 核心改变：改用白名单！只记录成功校验 GPS 且在场的人
    presentMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    
}, { timestamps: true });

resultSchema.index({ testId: 1, teamId: 1 });

export default mongoose.model('Result', resultSchema);