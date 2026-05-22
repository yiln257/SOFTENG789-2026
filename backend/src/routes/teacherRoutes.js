import express from 'express';
import { updateTeacherGPS } from '../controllers/locationController.js';
import { verifyToken, isTeacher } from '../middlewares/auth.js';
const router = express.Router();

router.post('/gps', [verifyToken, isTeacher], updateTeacherGPS);

export default router;