import User from '../models/User.js';
import jwt from 'jsonwebtoken'; // 需要 npm install jsonwebtoken

// 生成 JWT Token 的工具函数
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your_super_secret_key', { expiresIn: '12h' });
};

/**
 * 教师登录
 * POST /api/auth/teacher/login
 */
export const teacherLogin = async (req, res) => {
    const { email, password } = req.body;

    // 教师账号密码提前写死在后端环境变量中 (例如在 .env 中配置)
    const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'yi.lin.uoa@outlook.co.nz';
    const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || '666666';

    if (email !== TEACHER_EMAIL || password !== TEACHER_PASSWORD) {
        return res.status(401).json({ success: false, message: '教师邮箱或密码错误' });
    }

    const token = generateToken({ role: 'teacher', email });

    return res.json({
        success: true,
        message: '教师登录成功',
        token,
        user: { role: 'teacher', email }
    });
};

/**
 * 学生登录
 * POST /api/auth/student/login
 */
export const studentLogin = async (req, res) => {
    const { upi, password } = req.body;

    try {
        // 从数据库核对学生信息，并 populate 带出 team 信息
        const student = await User.findOne({ upi, role: 'student' }).populate('teamId');

        if (!student) {
            return res.status(404).json({ success: false, message: '未找到该 UPI 对应的学生' });
        }

        // 注意：根据你的需求，这里是明文密码比对（因为是生成的6位随机码）
        if (student.password !== password) {
            return res.status(401).json({ success: false, message: '登录密码错误' });
        }

        const token = generateToken({ 
            id: student._id, 
            upi: student.upi, 
            role: 'student', 
            teamId: student.teamId?._id 
        });

        return res.json({
            success: true,
            message: '学生登录成功',
            token,
            user: {
                id: student._id,
                name: student.name,
                upi: student.upi,
                email: student.email,
                team: student.teamId // 包含 teamName 和 members
            }
        });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
};