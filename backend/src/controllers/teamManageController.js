import User from '../models/User.js';
import Team from '../models/Team.js';
import xlsx from 'xlsx';
import crypto from 'crypto';
import { sendPasswordEmail } from '../services/emailService.js';

const normalizeUPI = (upi) => upi?.toString().trim().toLowerCase();
const generatePassword = () => crypto.randomBytes(6).toString('base64url').slice(0, 8);

export const importStudents = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an Excel or CSV file.' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const studentsData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (studentsData.length === 0) {
            return res.status(400).json({ success: false, message: 'The uploaded roster is empty.' });
        }

        const parsedStudents = [];
        const seenUpis = new Set();

        for (const row of studentsData) {
            const upi = normalizeUPI(row.UPI || row.upi);
            const name = row.Name || row.name;

            if (!upi || !name) continue;
            if (seenUpis.has(upi)) continue;

            seenUpis.add(upi);
            parsedStudents.push({
                upi,
                name: name.toString().trim(),
                email: `${upi}@aucklanduni.ac.nz`
            });
        }

        if (parsedStudents.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid students were found. The file must include Name and UPI columns.' });
        }

        const uploadedUpis = parsedStudents.map((student) => student.upi);
        const existingStudents = await User.find({ role: 'student' }).select('upi password').lean();
        const existingPasswordByUpi = new Map(existingStudents.map((student) => [student.upi, student.password]));

        const deleteResult = await User.deleteMany({
            role: 'student',
            upi: { $nin: uploadedUpis }
        });

        let createdCount = 0;
        let updatedCount = 0;

        for (const student of parsedStudents) {
            const existingPassword = existingPasswordByUpi.get(student.upi);
            const existingUser = await User.findOne({ role: 'student', upi: student.upi });
            if (!existingUser) {
                await User.create({
                    role: 'student',
                    upi: student.upi,
                    name: student.name,
                    email: student.email,
                    password: existingPassword || generatePassword(),
                    teamId: null
                });
                createdCount += 1;
            } else {
                existingUser.name = student.name;
                existingUser.email = student.email;
                existingUser.password = existingUser.password || existingPassword || generatePassword();
                existingUser.teamId = null;
                await existingUser.save();
                updatedCount += 1;
            }
        }

        await Team.updateMany({ isActive: true }, { $set: { isActive: false } });
        await User.updateMany({ role: 'student' }, { $set: { teamId: null } });

        res.status(200).json({
            success: true,
            message: `Roster replaced. Created ${createdCount}, updated ${updatedCount}, and removed ${deleteResult.deletedCount} students.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: `File parsing failed: ${error.message}` });
    }
};

export const getStudents = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('name upi email password')
            .sort({ upi: 1 })
            .lean();

        res.json({ success: true, students });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const clearStudents = async (req, res) => {
    try {
        const [deleteResult, teamUpdateResult] = await Promise.all([
            User.deleteMany({ role: 'student' }),
            Team.updateMany({ isActive: true }, { $set: { isActive: false } })
        ]);

        res.json({
            success: true,
            message: `Student roster cleared. Removed ${deleteResult.deletedCount} students and deactivated ${teamUpdateResult.modifiedCount || 0} active teams.`,
            deletedCount: deleteResult.deletedCount,
            deactivatedTeamCount: teamUpdateResult.modifiedCount || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendStudentPasswords = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('name upi email password')
            .sort({ upi: 1 })
            .lean();

        if (students.length === 0) {
            return res.status(400).json({ success: false, message: 'No students have been imported yet.' });
        }

        const sent = [];
        const failed = [];

        for (const student of students) {
            try {
                await sendPasswordEmail(student);
                sent.push(student.upi);
            } catch (error) {
                console.warn(`Failed to send password email to ${student.email}: ${error.message}`);
                failed.push({
                    upi: student.upi,
                    email: student.email,
                    error: error.message
                });
            }
        }

        res.json({
            success: failed.length === 0,
            message: `Password emails sent to ${sent.length} students${failed.length ? `; ${failed.length} failed. First error: ${failed[0].error}` : '.'}`,
            sentCount: sent.length,
            failed
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
