import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your_super_secret_key', { expiresIn: '12h' });
};

export const teacherLogin = async (req, res) => {
    const { email, password } = req.body;
    const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'yi.lin.uoa@outlook.co.nz';
    const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || '666666';

    if (email !== TEACHER_EMAIL || password !== TEACHER_PASSWORD) {
        return res.status(401).json({ success: false, message: '教师邮箱或密码错误' });
    }
    const token = generateToken({ role: 'teacher', email });
    return res.json({ success: true, message: '教师登录成功', token, user: { role: 'teacher', email } });
};

export const studentLogin = async (req, res) => {
    const { upi, password } = req.body;
    try {
        const student = await User.findOne({ upi, role: 'student' }).populate('teamId');
        if (!student) return res.status(404).json({ success: false, message: '未找到该 UPI 对应的学生' });
        if (student.password !== password) return res.status(401).json({ success: false, message: '登录密码错误' });

        const token = generateToken({ 
            id: student._id, upi: student.upi, role: 'student', teamId: student.teamId?._id 
        });
        return res.json({
            success: true, message: '学生登录成功', token,
            user: { id: student._id, name: student.name, upi: student.upi, email: student.email, team: student.teamId }
        });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
};