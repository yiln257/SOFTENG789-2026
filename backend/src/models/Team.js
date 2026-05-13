import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: true // 例如: "Team 1"
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

teamSchema.index({ teamName: 1 });

export default mongoose.model('Team', teamSchema);