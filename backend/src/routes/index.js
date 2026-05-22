import express from 'express';
import authRoutes from './authRoutes.js';
import teamRoutes from './teamRoutes.js';
import teacherRoutes from './teacherRoutes.js';
import testRoutes from './testRoutes.js';
import studentRoutes from './studentRoutes.js';

const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ message: 'pong', status: 'Server is running perfectly!' });
});

// 聚合子模块挂载（完美保持前端原有的 API 路径映射）
router.use('/auth', authRoutes);         // 生成 /auth/teacher/login 等
router.use('/teams', teamRoutes);       // 生成 /teams/import 等
router.use('/teacher', teacherRoutes);   // 生成 /teacher/gps
router.use('/tests', testRoutes);       // 生成 /tests, /tests/:testId/publish 等
router.use('/student', studentRoutes);   // 生成 /student/ready, /student/answer 等

export default router;