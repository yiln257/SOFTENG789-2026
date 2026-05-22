import express from 'express';
import { getTeamInfo, createTeam } from '../controllers/studentTeamController.js';
import {
    getLobbyStatus,
    checkLocationAndReady,
    fetchQuestionData,
    submitAnswer,
    submitFeedback
} from '../controllers/studentTestController.js';
import { verifyToken, isStudent } from '../middlewares/auth.js';

const router = express.Router();

router.get('/lobby', [verifyToken, isStudent], getLobbyStatus);
router.get('/team-info', [verifyToken, isStudent], getTeamInfo);
router.post('/team', [verifyToken, isStudent], createTeam);
router.post('/ready', [verifyToken, isStudent], checkLocationAndReady);
router.get('/question', [verifyToken, isStudent], fetchQuestionData);
router.post('/answer', [verifyToken, isStudent], submitAnswer);
router.post('/feedback', [verifyToken, isStudent], submitFeedback);

export default router;
