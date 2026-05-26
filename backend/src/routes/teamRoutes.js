import express from 'express';
import { clearStudents, getStudents, importStudents, sendStudentPasswords } from '../controllers/teamManageController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.get('/students', [verifyToken, isTeacher], getStudents);
router.delete('/students', [verifyToken, isTeacher], clearStudents);
router.post('/import', [verifyToken, isTeacher, upload.single('file')], importStudents);
router.post('/send-password-emails', [verifyToken, isTeacher], sendStudentPasswords);

export default router;
