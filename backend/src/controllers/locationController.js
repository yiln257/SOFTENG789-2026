import * as redisService from '../services/redisService.js';

export const updateTeacherGPS = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
            return res.status(400).json({ success: false, message: 'A valid GPS position is required.' });
        }

        await redisService.setTeacherGPS(lat, lng);
        req.app.get('io')?.emit('TEACHER_GPS_UPDATED', {
            status: 'ready',
            updatedAt: new Date()
        });
        res.json({ success: true, message: 'Classroom GPS point updated.' });
    } catch (error) {
        console.error('Failed to write teacher GPS:', error);
        res.status(500).json({ success: false, message: `Redis connection failed: ${error.message}` });
    }
};
