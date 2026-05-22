import User from '../models/User.js';
import xlsx from 'xlsx';
import crypto from 'crypto';

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

        let createdCount = 0;
        let updatedCount = 0;

        for (const row of studentsData) {
            const upi = normalizeUPI(row.UPI || row.upi);
            const name = row.Name || row.name;
            const password = row.Password || row.password || 'password123';

            if (!upi || !name) continue;

            const existingUser = await User.findOne({ upi });
            if (!existingUser) {
                await User.create({
                    role: 'student',
                    upi,
                    name: name.toString().trim(),
                    email: `${upi}@aucklanduni.ac.nz`,
                    password: row.Password || row.password ? password.toString() : generatePassword()
                });
                createdCount += 1;
            } else {
                existingUser.name = name.toString().trim();
                existingUser.email = existingUser.email || `${upi}@aucklanduni.ac.nz`;
                if (row.Password || row.password) {
                    existingUser.password = password.toString();
                }
                await existingUser.save();
                updatedCount += 1;
            }
        }

        res.status(200).json({
            success: true,
            message: `Roster import complete. Created ${createdCount} students and updated ${updatedCount}.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: `File parsing failed: ${error.message}` });
    }
};

export const printStudentPasswords = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('name upi email password')
            .sort({ upi: 1 })
            .lean();

        console.log('========== Student login passwords ==========');
        students.forEach((student) => {
            console.log(`To: ${student.email} | Name: ${student.name} | UPI: ${student.upi} | Password: ${student.password}`);
        });
        console.log('============================================');

        res.json({
            success: true,
            message: `Printed ${students.length} student passwords to the backend console.`,
            count: students.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
