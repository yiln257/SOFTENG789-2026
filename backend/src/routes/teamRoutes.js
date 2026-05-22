import express from 'express';
import { importStudents, printStudentPasswords } from '../controllers/teamManageController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.post('/import', [verifyToken, isTeacher, upload.single('file')], importStudents);
router.post('/print-passwords', [verifyToken, isTeacher], printStudentPasswords);

export default router;
