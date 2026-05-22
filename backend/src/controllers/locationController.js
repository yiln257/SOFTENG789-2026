import * as redisService from '../services/redisService.js';

export const updateTeacherGPS = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        await redisService.setTeacherGPS(lat, lng);
        res.json({ success: true, message: '教师位置已更新' });
    } catch (error) {
        console.error('Redis 定位写入失败:', error);
        res.status(500).json({ success: false, message: 'Redis 连不上啦: ' + error.message });
    }
};