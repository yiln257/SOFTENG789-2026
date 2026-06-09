import User from '../models/User.js';
import Team from '../models/Team.js';
import Test from '../models/Test.js';
import Result from '../models/Result.js';
import CheckIn from '../models/CheckIn.js';
import crypto from 'crypto';

const TEAM_MIN_SIZE = 3;
const TEAM_MAX_SIZE = 4;

const teamPopulation = [
    { path: 'members', select: 'name upi' },
    { path: 'leaderId', select: 'name upi' }
];

const isTeamReady = (team) => {
    const memberCount = team?.members?.length || 0;
    return memberCount >= TEAM_MIN_SIZE && memberCount <= TEAM_MAX_SIZE;
};

const serializeTeam = (team, studentId) => {
    if (!team) return null;
    const doc = typeof team.toObject === 'function' ? team.toObject() : team;
    const memberCount = doc.members?.length || 0;

    return {
        ...doc,
        memberCount,
        isReady: memberCount >= TEAM_MIN_SIZE && memberCount <= TEAM_MAX_SIZE,
        isLeader: doc.leaderId?._id?.toString?.() === studentId.toString()
            || doc.leaderId?.toString?.() === studentId.toString()
    };
};

const getActivePublishedTest = () => {
    return Test.findOne({ status: 'published' }).sort({ createdAt: -1 });
};

const generateTeamId = () => {
    return crypto.randomInt(0, 100000000).toString().padStart(8, '0');
};

const generateUniqueTeamId = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const teamId = generateTeamId();
        const exists = await Team.exists({ teamId });
        if (!exists) return teamId;
    }

    throw new Error('Unable to generate a unique Team ID. Please try again.');
};

const normalizeTeamId = (teamId) => teamId?.toString().trim();

const createOrUpdateResultForTeam = async (testId, team) => {
    if (!testId || !team || !isTeamReady(team)) return;

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

    try {
        const leader = await User.findById(leaderId);
        if (!leader) {
            return res.status(404).json({ success: false, message: 'Leader account not found.' });
        }
        if (leader.teamId) {
            return res.status(409).json({ success: false, message: 'You are already in a team for this test.' });
        }

        const teamId = await generateUniqueTeamId();
        const team = await Team.create({
            teamId,
            testId: null,
            leaderId: leader._id,
            members: [leader._id],
            isActive: true
        });

        leader.teamId = team._id;
        await leader.save();

        const populatedTeam = await Team.findById(team._id).populate(teamPopulation);
        emitTeamUpdate(req, populatedTeam);

        res.status(201).json({
            success: true,
            message: `Team ID ${teamId} created. Share it with your teammates.`,
            team: serializeTeam(populatedTeam, leaderId)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const joinTeam = async (req, res) => {
    const studentId = req.user.id;
    const teamId = normalizeTeamId(req.body.teamId);

    try {
        if (!/^\d{8}$/.test(teamId || '')) {
            return res.status(400).json({ success: false, message: 'Enter a valid 8-digit Team ID.' });
        }

        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }
        if (student.teamId) {
            return res.status(409).json({ success: false, message: 'You are already in a team.' });
        }

        const team = await Team.findOne({ teamId, isActive: true });
        if (!team) {
            return res.status(404).json({ success: false, message: `No team was found for Team ID ${teamId}.` });
        }

        const memberIds = team.members.map((memberId) => memberId.toString());
        if (memberIds.includes(studentId.toString())) {
            return res.status(409).json({ success: false, message: 'You are already in this team.' });
        }
        if (memberIds.length >= TEAM_MAX_SIZE) {
            return res.status(409).json({ success: false, message: 'This team is already full.' });
        }

        team.members.push(student._id);

        const activeTest = await getActivePublishedTest();
        if (!team.testId && activeTest && isTeamReady(team)) {
            team.testId = activeTest._id;
        }

        await team.save();
        student.teamId = team._id;
        await student.save();

        await createOrUpdateResultForTeam(team.testId || activeTest?._id, team);

        const populatedTeam = await Team.findById(team._id).populate(teamPopulation);
        emitTeamUpdate(req, populatedTeam);

        res.json({
            success: true,
            message: `Joined Team ID ${teamId}.`,
            team: serializeTeam(populatedTeam, studentId)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
