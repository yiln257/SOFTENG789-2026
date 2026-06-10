import * as redisService from '../services/redisService.js';

const TEACHER_GPS_TTL_MS = 15 * 60 * 1000;

const serializeTeacherGpsStatus = (teacherGps) => {
    const timestamp = Number.parseInt(teacherGps?.timestamp, 10);
    const hasPosition = Boolean(teacherGps?.lat && teacherGps?.lng);
    const hasFreshTimestamp = Number.isFinite(timestamp) && Date.now() - timestamp <= TEACHER_GPS_TTL_MS;
    const remainingMs = Number.isFinite(timestamp)
        ? Math.max(0, timestamp + TEACHER_GPS_TTL_MS - Date.now())
        : 0;

    return {
        isSet: hasPosition,
        isReady: hasPosition && hasFreshTimestamp,
        status: hasPosition && hasFreshTimestamp ? 'ready' : hasPosition ? 'expired' : 'missing',
        lat: hasPosition ? Number(teacherGps.lat) : null,
        lng: hasPosition ? Number(teacherGps.lng) : null,
        updatedAt: Number.isFinite(timestamp) ? new Date(timestamp) : null,
        expiresAt: Number.isFinite(timestamp) ? new Date(timestamp + TEACHER_GPS_TTL_MS) : null,
        remainingSeconds: Math.ceil(remainingMs / 1000)
    };
};

export const getTeacherGPSStatus = async (req, res) => {
    try {
        const teacherGps = await redisService.getTeacherGPS();
        res.json({
            success: true,
            teacherGps: serializeTeacherGpsStatus(teacherGps)
        });
    } catch (error) {
        console.error('Failed to read teacher GPS:', error);
        res.status(500).json({ success: false, message: `Redis connection failed: ${error.message}` });
    }
};

export const updateTeacherGPS = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
            return res.status(400).json({ success: false, message: 'A valid GPS position is required.' });
        }

        const timestamp = await redisService.setTeacherGPS(lat, lng);
        const teacherGps = serializeTeacherGpsStatus({ lat, lng, timestamp });
        req.app.get('io')?.emit('TEACHER_GPS_UPDATED', {
            status: teacherGps.status,
            updatedAt: teacherGps.updatedAt,
            expiresAt: teacherGps.expiresAt
        });
        res.json({ success: true, message: 'Classroom GPS point updated.', teacherGps });
    } catch (error) {
        console.error('Failed to write teacher GPS:', error);
        res.status(500).json({ success: false, message: `Redis connection failed: ${error.message}` });
    }
};
