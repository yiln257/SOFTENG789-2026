import express from 'express';
import { getTeamInfo } from '../controllers/studentTeamController.js';
import { checkLocationAndReady, fetchQuestionData, submitAnswer, submitFeedback } from '../controllers/studentTestController.js';
import { verifyToken, isStudent } from '../middlewares/auth.js';
const router = express.Router();

router.get('/team-info', [verifyToken, isStudent], getTeamInfo);
router.post('/ready', [verifyToken, isStudent], checkLocationAndReady);
router.get('/question', [verifyToken, isStudent], fetchQuestionData);
router.post('/answer', [verifyToken, isStudent], submitAnswer);
router.post('/feedback', [verifyToken, isStudent], submitFeedback);

export default router;