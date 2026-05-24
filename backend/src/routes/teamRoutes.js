import express from 'express';
import { getStudents, importStudents, printStudentPasswords } from '../controllers/teamManageController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.get('/students', [verifyToken, isTeacher], getStudents);
router.post('/import', [verifyToken, isTeacher, upload.single('file')], importStudents);
router.post('/print-passwords', [verifyToken, isTeacher], printStudentPasswords);

export default router;
