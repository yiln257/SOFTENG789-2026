import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your_super_secret_key', { expiresIn: '12h' });
};

const normalizeUPI = (upi) => upi?.toString().trim().toLowerCase();

export const teacherLogin = async (req, res) => {
    const { email, password } = req.body;
    const TEACHER_EMAIL = process.env.TEACHER_EMAIL || 'jesin.james@auckland.ac.nz';
    const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || '88888888';

    if (email !== TEACHER_EMAIL || password !== TEACHER_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Teacher email or password is incorrect.' });
    }

    const token = generateToken({ role: 'teacher', email });
    return res.json({
        success: true,
        message: 'Teacher login successful.',
        token,
        user: { role: 'teacher', email }
    });
};

export const studentLogin = async (req, res) => {
    const { upi, password } = req.body;

    try {
        const student = await User.findOne({
            upi: normalizeUPI(upi),
            role: 'student'
        }).populate({
            path: 'teamId',
            match: { isActive: true },
            populate: [
                { path: 'members', select: 'name upi' },
                { path: 'leaderId', select: 'name upi' }
            ]
        });

        if (!student) {
            return res.status(404).json({ success: false, message: 'No student account was found for this UPI.' });
        }

        if (student.password !== password) {
            return res.status(401).json({ success: false, message: 'Password is incorrect.' });
        }

        const token = generateToken({
            id: student._id,
            upi: student.upi,
            role: 'student',
            teamId: student.teamId?._id || null
        });

        return res.json({
            success: true,
            message: 'Student login successful.',
            token,
            user: {
                id: student._id,
                name: student.name,
                upi: student.upi,
                email: student.email,
                teamId: student.teamId?._id || null,
                team: student.teamId || null
            }
        });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
