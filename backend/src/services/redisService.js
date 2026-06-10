import { redisClient } from '../config/redis.js';

export const setTeacherGPS = async (lat, lng) => {
    const timestamp = Date.now().toString();
    await redisClient.hSet('teacher:gps', {
        lat: lat.toString(),
        lng: lng.toString(),
        timestamp
    });
    return timestamp;
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

const getQuestionAnswerStateKey = (testId, teamId, seq) => {
    return `test:${testId}:team:${teamId}:q:${seq}:answer_state`;
};

export const setQuestionAnswerState = async (testId, teamId, seq, state) => {
    const key = getQuestionAnswerStateKey(testId, teamId, seq);
    await redisClient.set(key, JSON.stringify(state), { EX: 8 * 60 * 60 });
};

export const getQuestionAnswerState = async (testId, teamId, seq) => {
    const key = getQuestionAnswerStateKey(testId, teamId, seq);
    const state = await redisClient.get(key);
    return state ? JSON.parse(state) : null;
};
