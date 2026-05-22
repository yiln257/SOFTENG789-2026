import { redisClient } from '../config/redis.js';

export const setTeacherGPS = async (lat, lng) => {
    await redisClient.hSet('teacher:gps', {
        lat: lat.toString(),
        lng: lng.toString(),
        timestamp: Date.now().toString()
    });
};

export const getTeacherGPS = async () => {
    return redisClient.hGetAll('teacher:gps');
};

export const acquireDeviceLock = async (testId, teamId, studentId) => {
    const key = `test:${testId}:team:${teamId}:active_device`;
    const result = await redisClient.set(key, studentId.toString(), { NX: true });
    return result !== null;
};

export const getActiveDevice = async (testId, teamId) => {
    const key = `test:${testId}:team:${teamId}:active_device`;
    return redisClient.get(key);
};

export const releaseDeviceLock = async (testId, teamId) => {
    const key = `test:${testId}:team:${teamId}:active_device`;
    await redisClient.del(key);
};

export const incrementQuestionAttempts = async (testId, teamId, seq) => {
    const key = `test:${testId}:team:${teamId}:q:${seq}:attempts`;
    return redisClient.incr(key);
};

export const getQuestionAttempts = async (testId, teamId, seq) => {
    const key = `test:${testId}:team:${teamId}:q:${seq}:attempts`;
    const attempts = await redisClient.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
};
