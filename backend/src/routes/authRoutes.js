import express from 'express';
import { teacherLogin, studentLogin } from '../controllers/authController.js';
const router = express.Router();

router.post('/teacher/login', teacherLogin);
router.post('/student/login', studentLogin);

export default router;