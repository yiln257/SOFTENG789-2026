import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: true // 例如: "Team 1"
    },
    members: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        // 增加自定义校验：限制数组长度为 4 到 5 人
        validate: [
            function(val) {
                return val.length >= 4 && val.length <= 5;
            },
            '一个小组的人数必须在 4 到 5 人之间'
        ]
    }
}, { timestamps: true });

teamSchema.index({ teamName: 1 });

export default mongoose.model('Team', teamSchema);