import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    teamId: {
        type: String,
        trim: true,
        match: [/^\d{8}$/, 'Team ID must be an 8-digit number.']
    },
    testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
        default: null
    },
    leaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        validate: [
            function (val) {
                return val.length >= 1 && val.length <= 4;
            },
            'A team must contain 1 to 4 students.'
        ]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lockedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

teamSchema.index({ testId: 1, isActive: 1 });
teamSchema.index({ teamId: 1 }, { unique: true, sparse: true });
teamSchema.index({ leaderId: 1 });
teamSchema.index({ members: 1 });

export default mongoose.model('Team', teamSchema);
