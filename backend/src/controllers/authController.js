import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your_super_secret_key', { expiresIn: '12h' });
};

const normalizeUPI = (upi) => upi?.toString().trim().toLowerCase();

const readEnvFile = () => {
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) return {};
        return dotenv.parse(fs.readFileSync(envPath));
    } catch (error) {
        console.warn('Unable to read .env for teacher login:', error.message);
        return {};
    }
};

const getTeacherCredentials = () => {
    const envFile = readEnvFile();
    const source = { ...process.env, ...envFile };
    const account = (
        source.TEACHER_ACCOUNT
        || source.TEACHER_USERNAME
        || source.TEACHER_USER
        || source.TEACHER_EMAIL
        || ''
    ).toString().trim();
    const password = (source.TEACHER_PASSWORD || '').toString();

    return {
        account,
        password,
        isConfigured: Boolean(account && password)
    };
};

export const teacherLogin = async (req, res) => {
    const account = (req.body.account || req.body.email || '').toString().trim();
    const { password } = req.body;
    const teacher = getTeacherCredentials();

    if (!teacher.isConfigured) {
        return res.status(500).json({ success: false, message: 'Teacher login is not configured. Set TEACHER_EMAIL and TEACHER_PASSWORD in backend/.env.' });
    }

    if (account !== teacher.account || password !== teacher.password) {
        return res.status(401).json({ success: false, message: 'Teacher account or password is incorrect.' });
    }

    const token = generateToken({ role: 'teacher', account });
    return res.json({
        success: true,
        message: 'Teacher login successful.',
        token,
        user: { role: 'teacher', account, email: account }
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
