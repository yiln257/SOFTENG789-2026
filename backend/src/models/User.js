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
        sparse: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true
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
userSchema.index({ role: 1, upi: 1 });

export default mongoose.model('User', userSchema);
