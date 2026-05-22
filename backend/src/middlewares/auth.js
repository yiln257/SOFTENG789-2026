import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token was provided.' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_key');
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Token is invalid or has expired. Please log in again.' });
    }
};

export const isTeacher = (req, res, next) => {
    if (req.user?.role !== 'teacher') {
        return res.status(403).json({ success: false, message: 'Teacher permission is required.' });
    }
    next();
};

export const isStudent = (req, res, next) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Student permission is required.' });
    }
    next();
};
