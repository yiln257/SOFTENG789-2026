import express from 'express';

// 1. 引入 Auth 控制器
import { teacherLogin, studentLogin } from '../controllers/authController.js';

// 2. 引入 Team 控制器
import { importStudents, randomGroup, sendGroupingEmails } from '../controllers/teamController.js';

// 3. 引入 Auth 中间件 (这里补上了 isStudent)
import { verifyToken, isTeacher, isStudent } from '../middlewares/auth.js';

// 4. 引入 Test 控制器 (这里合并了引用，并补上了 exportTestResults)
import {
    updateTeacherGPS, 
    importTest, 
    publishTest, 
    nextQuestion, 
    closeTest,
    checkLocationAndReady, 
    fetchQuestionData, 
    submitAnswer, 
    submitFeedback,
    getTestStatistics,
    exportTestResults
} from '../controllers/testController.js';

const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ message: 'pong', status: 'Server is running perfectly!' });
});

// ---------- 验证相关 ----------
router.post('/auth/teacher/login', teacherLogin);
router.post('/auth/student/login', studentLogin);

// ---------- 教师：学生与分组管理 ----------
router.post('/teams/import', [verifyToken, isTeacher], importStudents);
router.post('/teams/random-group', [verifyToken, isTeacher], randomGroup);
router.post('/teams/send-emails', [verifyToken, isTeacher], sendGroupingEmails);

// ---------- 教师：试卷管理 ----------
router.post('/teacher/gps', [verifyToken, isTeacher], updateTeacherGPS);
router.post('/tests/import', [verifyToken, isTeacher], importTest);
router.post('/tests/:testId/publish', [verifyToken, isTeacher], publishTest);
router.post('/tests/:testId/next', [verifyToken, isTeacher], nextQuestion);
router.post('/tests/:testId/close', [verifyToken, isTeacher], closeTest);

// 新增的统计与导出接口
router.get('/tests/:testId/statistics', [verifyToken, isTeacher], getTestStatistics);
router.get('/tests/:testId/export', [verifyToken, isTeacher], exportTestResults);

// ---------- 学生：答题与反馈流程 ----------
router.post('/student/ready', [verifyToken, isStudent], checkLocationAndReady);
router.get('/student/question', [verifyToken, isStudent], fetchQuestionData);
router.post('/student/answer', [verifyToken, isStudent], submitAnswer);
router.post('/student/feedback', [verifyToken, isStudent], submitFeedback);

export default router;