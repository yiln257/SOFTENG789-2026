import { redisClient } from '../config/redis.js';

/**
 * 教师 GPS 管理
 */
export const setTeacherGPS = async (lat, lng) => {
    // Redis HASH 存储
    await redisClient.hSet('teacher:gps', {
        lat: lat.toString(),
        lng: lng.toString(),
        timestamp: Date.now().toString()
    });
};

export const getTeacherGPS = async () => {
    return await redisClient.hGetAll('teacher:gps');
};

/**
 * 邮件发送冷却按钮锁 (1小时 = 3600秒)
 */
export const lockSendEmailButton = async () => {
    await redisClient.set('btn_cd:send_emails', '1', { EX: 3600 });
};

export const isSendEmailButtonLocked = async () => {
    const isLocked = await redisClient.get('btn_cd:send_emails');
    return isLocked === '1';
};

/**
 * 学生 GPS 就位标记 (允许误差15分钟 = 900秒)
 */
export const setStudentReady = async (teamId, studentId) => {
    const key = `team:${teamId}:student:${studentId}:ready`;
    await redisClient.set(key, '1', { EX: 900 });
};

export const checkStudentReady = async (teamId, studentId) => {
    const key = `team:${teamId}:student:${studentId}:ready`;
    const isReady = await redisClient.get(key);
    return isReady === '1';
};

/**
 * 设备抢占互斥锁 (核心：刮刮乐机制)
 * 使用 SETNX (Set if Not eXists) 实现只能有一个设备答题
 */
export const acquireDeviceLock = async (testId, teamId, studentId) => {
    const key = `test:${testId}:team:${teamId}:active_device`;
    // SETNX 命令对应 Redis 4+ 版本的 set(key, value, { NX: true })
    const result = await redisClient.set(key, studentId.toString(), { NX: true });
    // 如果返回 OK (true)，说明抢占成功；如果返回 null，说明锁已被其他人占用
    return result !== null; 
};

export const getActiveDevice = async (testId, teamId) => {
    const key = `test:${testId}:team:${teamId}:active_device`;
    return await redisClient.get(key);
};

export const releaseDeviceLock = async (testId, teamId) => {
    const key = `test:${testId}:team:${teamId}:active_device`;
    await redisClient.del(key);
};

/**
 * 记录刮刮乐某题的尝试次数
 */
export const incrementQuestionAttempts = async (testId, teamId, seq) => {
    const key = `test:${testId}:team:${teamId}:q:${seq}:attempts`;
    // 自增 1
    return await redisClient.incr(key); 
};

export const getQuestionAttempts = async (testId, teamId, seq) => {
    const key = `test:${testId}:team:${teamId}:q:${seq}:attempts`;
    const attempts = await redisClient.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
};