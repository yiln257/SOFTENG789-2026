import User from '../models/User.js';
import Team from '../models/Team.js';

export const getTeamInfo = async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student || !student.teamId) {
            return res.status(404).json({ success: false, message: '未找到学生或该学生尚未分配队伍' });
        }
        const team = await Team.findById(student.teamId).populate('members', 'name upi');
        res.json({ success: true, team });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};