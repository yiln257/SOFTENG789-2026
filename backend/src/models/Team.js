import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: true
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
                return val.length >= 3 && val.length <= 4;
            },
            'A team must contain 3 to 4 students.'
        ]
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

teamSchema.index({ testId: 1, isActive: 1 });
teamSchema.index({ leaderId: 1 });
teamSchema.index({ members: 1 });

export default mongoose.model('Team', teamSchema);
