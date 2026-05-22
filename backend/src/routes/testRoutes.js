import express from 'express';
import {
    importTest,
    publishTest,
    nextQuestion,
    closeTest,
    getTestList,
    getTestDetail,
    deleteTest,
    deleteTestResults
} from '../controllers/testManageController.js';
import { getTestStatistics, exportTestResults } from '../controllers/testReportController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.post('/import', [verifyToken, isTeacher, upload.single('file')], importTest);
router.post('/:testId/publish', [verifyToken, isTeacher], publishTest);
router.post('/:testId/next', [verifyToken, isTeacher], nextQuestion);
router.post('/:testId/close', [verifyToken, isTeacher], closeTest);
router.get('/', [verifyToken, isTeacher], getTestList);
router.get('/:testId/statistics', [verifyToken, isTeacher], getTestStatistics);
router.get('/:testId/export', [verifyToken, isTeacher], exportTestResults);
router.delete('/:testId/results', [verifyToken, isTeacher], deleteTestResults);
router.get('/:testId', [verifyToken, isTeacher], getTestDetail);
router.delete('/:testId', [verifyToken, isTeacher], deleteTest);

export default router;
