import express from 'express';
import authRoutes from './authRoutes.js';
import teamRoutes from './teamRoutes.js';
import teacherRoutes from './teacherRoutes.js';
import testRoutes from './testRoutes.js';
import studentRoutes from './studentRoutes.js';

const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ message: 'pong', status: 'Server is running.' });
});

router.use('/auth', authRoutes);
router.use('/teams', teamRoutes);
router.use('/teacher', teacherRoutes);
router.use('/tests', testRoutes);
router.use('/student', studentRoutes);

export default router;
