import User from '../models/User.js';
import Team from '../models/Team.js';
import Test from '../models/Test.js';
import Result from '../models/Result.js';
import CheckIn from '../models/CheckIn.js';

const normalizeUPI = (upi) => upi?.toString().trim().toLowerCase();

const teamPopulation = [
    { path: 'members', select: 'name upi' },
    { path: 'leaderId', select: 'name upi' }
];

const serializeTeam = (team, studentId) => {
    if (!team) return null;
    const doc = typeof team.toObject === 'function' ? team.toObject() : team;
    return {
        ...doc,
        isLeader: doc.leaderId?._id?.toString?.() === studentId.toString()
            || doc.leaderId?.toString?.() === studentId.toString()
    };
};

const getActivePublishedTest = () => {
    return Test.findOne({ status: 'published' }).sort({ createdAt: -1 });
};

const createOrUpdateResultForTeam = async (testId, team) => {
    if (!testId || !team) return;

    const memberIds = team.members.map((id) => id.toString());
    const passedCheckIns = await CheckIn.find({
        testId,
        studentId: { $in: memberIds },
        status: 'passed'
    }).select('studentId').lean();

    await Result.findOneAndUpdate(
        { testId, teamId: team._id },
        {
            $setOnInsert: {
                activeStudentId: team.leaderId,
                answers: [],
                totalScore: 0
            },
            $addToSet: {
                presentMembers: { $each: passedCheckIns.map((record) => record.studentId) }
            }
        },
        { upsert: true, new: true }
    );
};

const emitTeamUpdate = (req, team) => {
    const io = req.app.get('io');
    if (!io || !team) return;

    const memberIds = team.members.map((member) => member._id || member);

    memberIds.forEach((memberId) => {
        io.to(`user_${memberId.toString()}`).emit('TEAM_UPDATED', {
            team: serializeTeam(team, memberId)
        });
    });
    io.to(`team_${team._id}`).emit('TEAM_UPDATED', { team: serializeTeam(team, team.leaderId?._id || team.leaderId) });
};

export const getTeamInfo = async (req, res) => {
    const studentId = req.user.id;

    try {
        const student = await User.findById(studentId).populate({
            path: 'teamId',
            match: { isActive: true },
            populate: teamPopulation
        });

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }

        if (!student.teamId) {
            if (student.teamId === null) {
                return res.json({ success: true, team: null });
            }
            student.teamId = null;
            await student.save();
            return res.json({ success: true, team: null });
        }

        res.json({ success: true, team: serializeTeam(student.teamId, studentId) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createTeam = async (req, res) => {
    const leaderId = req.user.id;
    const teammates = Array.isArray(req.body.teammates) ? req.body.teammates : [];

    try {
        if (teammates.length < 2 || teammates.length > 3) {
            return res.status(400).json({
                success: false,
                message: 'Enter 2 or 3 teammates. Teams must contain 3 to 4 students including you.'
            });
        }

        const leader = await User.findById(leaderId);
        if (!leader) {
            return res.status(404).json({ success: false, message: 'Leader account not found.' });
        }
        if (leader.teamId) {
            return res.status(409).json({ success: false, message: 'You are already in a team for this test.' });
        }

        const normalized = teammates.map((mate) => ({
            upi: normalizeUPI(mate.upi),
            password: mate.password?.toString() || ''
        }));

        const teammateUpis = normalized.map((mate) => mate.upi).filter(Boolean);
        const uniqueUpis = new Set(teammateUpis);

        if (uniqueUpis.size !== teammates.length) {
            return res.status(400).json({ success: false, message: 'Each teammate UPI must be unique.' });
        }

        if (uniqueUpis.has(leader.upi)) {
            return res.status(400).json({ success: false, message: 'Do not include your own UPI in the teammate list.' });
        }

        const students = await User.find({
            role: 'student',
            upi: { $in: teammateUpis }
        });

        const studentMap = new Map(students.map((student) => [student.upi, student]));
        const memberIds = [leader._id];

        for (const mate of normalized) {
            const student = studentMap.get(mate.upi);
            if (!student) {
                return res.status(404).json({ success: false, message: `No student was found for UPI ${mate.upi}.` });
            }
            if (student.password !== mate.password) {
                return res.status(400).json({ success: false, message: `Password is incorrect for UPI ${mate.upi}.` });
            }
            if (student.teamId) {
                return res.status(409).json({ success: false, message: `${student.name} is already in a team.` });
            }
            memberIds.push(student._id);
        }

        const activeTest = await getActivePublishedTest();
        const team = await Team.create({
            teamName: `Team ${leader.upi}-${Date.now().toString().slice(-5)}`,
            testId: activeTest?._id || null,
            leaderId: leader._id,
            members: memberIds,
            isActive: true
        });

        await User.updateMany({ _id: { $in: memberIds } }, { $set: { teamId: team._id } });
        await createOrUpdateResultForTeam(activeTest?._id, team);

        const populatedTeam = await Team.findById(team._id).populate(teamPopulation);
        emitTeamUpdate(req, populatedTeam);

        res.status(201).json({
            success: true,
            message: 'Team created successfully.',
            team: serializeTeam(populatedTeam, leaderId)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
