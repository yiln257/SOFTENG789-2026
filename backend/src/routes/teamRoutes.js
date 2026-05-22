import express from 'express';
import { importStudents, randomGroup, sendGroupingEmails } from '../controllers/teamManageController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
const router = express.Router();

router.post('/import', [verifyToken, isTeacher, upload.single('file')], importStudents);
router.post('/random-group', [verifyToken, isTeacher], randomGroup);
router.post('/send-emails', [verifyToken, isTeacher], sendGroupingEmails);

export default router;