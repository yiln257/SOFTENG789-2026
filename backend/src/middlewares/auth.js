import jwt from 'jsonwebtoken';

/**
 * 验证 JWT Token 是否有效
 */
export const verifyToken = (req, res, next) => {
    // 从请求头获取 token: "Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: '访问拒绝，未提供有效的 Token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_key');
        req.user = decoded; // 将解析出的用户信息 (id, role, teamId等) 挂载到 req 上
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Token 无效或已过期，请重新登录' });
    }
};

/**
 * 验证是否为教师权限
 */
export const isTeacher = (req, res, next) => {
    if (req.user?.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足：仅教师可执行此操作' });
    }
    next();
};

/**
 * 验证是否为学生权限
 */
export const isStudent = (req, res, next) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({ success: false, message: '权限不足：仅学生可执行此操作' });
    }
    next();
};