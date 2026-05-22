import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['passed', 'failed'],
        required: true
    },
    distanceMeters: {
        type: Number,
        default: null
    },
    checkedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

checkInSchema.index({ testId: 1, studentId: 1 }, { unique: true });
checkInSchema.index({ studentId: 1, status: 1 });

export default mongoose.model('CheckIn', checkInSchema);
