import User from '../models/User.js';
import Team from '../models/Team.js';
import xlsx from 'xlsx';
import crypto from 'crypto';

const generateRandomPassword = () => crypto.randomBytes(20).toString('alphanumeric').slice(0, 6);

export const importStudents = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: '请上传 Excel 或 CSV 文件' });
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const studentsData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (studentsData.length === 0) return res.status(400).json({ success: false, message: '表格为空或解析失败' });

        let newCount = 0;
        for (const row of studentsData) {
            const upi = row['UPI'] || row['upi'];
            const name = row['Name'] || row['name'];
            if (!upi || !name) continue;

            const existingUser = await User.findOne({ upi: upi.toString() });
            if (!existingUser) {
                await User.create({
                    role: 'student', upi: upi.toString(), name: name.toString(),
                    email: `${upi}@aucklanduni.ac.nz`, password: 'password123'
                });
                newCount++;
            }
        }
        res.status(200).json({ success: true, message: `成功导入/更新数据，新创建 ${newCount} 名学生` });
    } catch (error) {
        res.status(500).json({ success: false, message: '文件解析失败: ' + error.message });
    }
};

export const randomGroup = async (req, res) => {
    try {
        await Team.deleteMany({});
        await User.updateMany({ role: 'student' }, { teamId: null });

        const students = await User.find({ role: 'student' });
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        if (shuffled.length < 4) return res.status(400).json({ success: false, message: '学生人数不足以分组' });

        const teamGroups = [];
        for (let i = 0; i < shuffled.length; i += 4) { teamGroups.push(shuffled.slice(i, i + 4)); }

        const lastGroup = teamGroups[teamGroups.length - 1];
        if (lastGroup.length < 4 && teamGroups.length > 1) {
            const remainders = teamGroups.pop();
            remainders.forEach((student, index) => { teamGroups[index].push(student); });
        }

        for (let i = 0; i < teamGroups.length; i++) {
            const memberIds = teamGroups[i].map(s => s._id);
            const team = await Team.create({ teamName: `Team ${i + 1}`, members: memberIds });
            await User.updateMany({ _id: { $in: memberIds } }, { teamId: team._id });
        }

        const result = await Team.find().populate('members', 'name upi');
        res.json({ success: true, message: '分组成功', teams: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendGroupingEmails = async (req, res) => {
    try {
        const teams = await Team.find().populate('members');
        dispatchEmailsSequentially(teams); 
        res.json({ success: true, message: '邮件队列已启动，预计 1 小时内发送完毕' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

async function dispatchEmailsSequentially(teams) {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    for (const team of teams) {
        for (const student of team.members) {
            console.log(`[发送至 ${student.email}] 姓名: ${student.name}, 组别: ${team.teamName}, UPI: ${student.upi}`);
            await delay(3600);
        }
    }
}