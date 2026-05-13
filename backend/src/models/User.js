import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['teacher', 'student'],
        required: true
    },
    upi: {
        type: String,
        unique: true,
        sparse: true // 允许教师没有 UPI 但保持学生 UPI 唯一
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        default: null
    }
}, { timestamps: true });

userSchema.index({ teamId: 1 });

export default mongoose.model('User', userSchema);