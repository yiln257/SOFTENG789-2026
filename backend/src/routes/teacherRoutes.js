import express from 'express';
import { getTeacherGPSStatus, updateTeacherGPS } from '../controllers/locationController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
const router = express.Router();

router.get('/gps', [verifyToken, isTeacher], getTeacherGPSStatus);
router.post('/gps', [verifyToken, isTeacher], updateTeacherGPS);

export default router;
