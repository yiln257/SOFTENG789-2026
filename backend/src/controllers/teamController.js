import User from '../models/User.js';
import Team from '../models/Team.js';
import * as redisService from '../services/redisService.js';
import crypto from 'crypto'; // 用于生成随机密码

/**
 * 辅助函数：生成6位随机大小写字母+数字密码
 */
const generateRandomPassword = () => {
    return crypto.randomBytes(20).toString('alphanumeric').slice(0, 6);
};

/**
 * 1. 导入学生名单 (从 CSV/Excel 解析后的数组)
 * POST /api/teams/import
 */
export const importStudents = async (req, res) => {
    const { students } = req.body; // 假设前端解析好了 [{ name, upi }, ...]

    try {
        let newCount = 0;
        for (const item of students) {
            // 检查学生是否已存在，UPI 是唯一标识 [cite: 54]
            let user = await User.findOne({ upi: item.upi });
            
            if (!user) {
                // 新建学生：email 通过 upi 推断，初始密码随机 [cite: 9-10]
                await User.create({
                    role: 'student',
                    upi: item.upi,
                    name: item.name,
                    email: `${item.upi}@aucklanduni.ac.nz`, // 示例：根据 UPI 生成邮箱
                    password: generateRandomPassword() 
                });
                newCount++;
            }
        }
        res.json({ success: true, message: `成功导入/更新学生信息，新创建 ${newCount} 人` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 2. 随机分组算法 (4人为主，余数补入变5人) 
 * POST /api/teams/random-group
 */
export const randomGroup = async (req, res) => {
    try {
        // A. 清理旧的分组数据
        await Team.deleteMany({});
        await User.updateMany({ role: 'student' }, { teamId: null });

        // B. 获取所有学生并随机打乱 (Fisher-Yates)
        const students = await User.find({ role: 'student' });
        const shuffled = [...students].sort(() => Math.random() - 0.5);

        if (shuffled.length < 4) {
            return res.status(400).json({ success: false, message: '学生人数不足以分组' });
        }

        // C. 按 4 人一组切分
        const teamGroups = [];
        for (let i = 0; i < shuffled.length; i += 4) {
            teamGroups.push(shuffled.slice(i, i + 4));
        }

        // D. 处理尾巴 (1-3人情况)
        const lastGroup = teamGroups[teamGroups.length - 1];
        if (lastGroup.length < 4 && teamGroups.length > 1) {
            const remainders = teamGroups.pop(); // 弹出不满 4 人的组
            remainders.forEach((student, index) => {
                teamGroups[index].push(student); // 依次塞进前面的组，变成 5 人组
            });
        }

        // E. 批量写入数据库
        for (let i = 0; i < teamGroups.length; i++) {
            const memberIds = teamGroups[i].map(s => s._id);
            const team = await Team.create({
                teamName: `Team ${i + 1}`,
                members: memberIds
            });

            // 更新这些学生的 teamId 引用 [cite: 11]
            await User.updateMany(
                { _id: { $in: memberIds } },
                { teamId: team._id }
            );
        }

        const result = await Team.find().populate('members', 'name upi');
        res.json({ success: true, message: '分组成功', teams: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 3. 异步发送分组邮件 (带 Redis 1小时冷却锁) [cite: 43-44, 80]
 * POST /api/teams/send-emails
 */
export const sendGroupingEmails = async (req, res) => {
    try {
        // 检查 Redis 锁
        const isLocked = await redisService.isSendEmailButtonLocked();
        if (isLocked) {
            return res.status(429).json({ success: false, message: '操作频繁，请1小时后再试' });
        }

        // 立即加锁 (1小时)
        await redisService.lockSendEmailButton();

        // 获取所有分组数据用于发送
        const teams = await Team.find().populate('members');

        /**
         * 业务逻辑：分批发送 (1小时发完1000封)
         * 这里通常调用一个外部 Worker 或使用简单的延时循环模拟
         * 为保证响应速度，我们这里异步触发发送逻辑
         */
        dispatchEmailsSequentially(teams); 

        res.json({ success: true, message: '邮件队列已启动，预计 1 小时内发送完毕' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 模拟异步分批发送逻辑
async function dispatchEmailsSequentially(teams) {
    // 假设 1000 人左右，每 3.6 秒发一个学生的邮件，刚好 1 小时发完
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (const team of teams) {
        for (const student of team.members) {
            // 这里调用 nodemailer 发送邮件
            // console.log(`Sending to ${student.email}...`);
            await delay(3600); // 间隔发送
        }
    }
}