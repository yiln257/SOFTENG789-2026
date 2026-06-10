import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useGeoLocation } from '../../hooks/useGeoLocation';
import request from '../../api/request';

const formatCountdown = (seconds) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
};

export default function StudentDashboard() {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();
    const { getPosition, isLocating, geoError } = useGeoLocation();

    const [lobby, setLobby] = useState(null);
    const [loading, setLoading] = useState(true);
    const [teamMsg, setTeamMsg] = useState('');
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [joiningTeam, setJoiningTeam] = useState(false);
    const [dissolvingTeam, setDissolvingTeam] = useState(false);
    const [teamIdInput, setTeamIdInput] = useState('');
    const [now, setNow] = useState(Date.now());

    const fetchLobby = async () => {
        try {
            const res = await request.get('/student/lobby');
            if (res.success) {
                setLobby(res);
                updateUser({
                    teamId: res.team?._id || null,
                    team: res.team || null
                });
            }
        } catch (error) {
            console.error('Failed to load student lobby:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLobby();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!socket) return undefined;

        const refresh = () => fetchLobby();
        socket.on('TEAM_UPDATED', refresh);
        socket.on('TEST_STARTED', refresh);
        socket.on('TEST_ENDED', refresh);
        socket.on('TEACHER_GPS_UPDATED', refresh);

        return () => {
            socket.off('TEAM_UPDATED', refresh);
            socket.off('TEST_STARTED', refresh);
            socket.off('TEST_ENDED', refresh);
            socket.off('TEACHER_GPS_UPDATED', refresh);
        };
    }, [socket]);

    useEffect(() => {
        const teamId = lobby?.team?._id;
        if (socket && teamId) {
            socket.emit('join_team', { teamId, studentId: user?.id || user?._id });
        }
    }, [socket, lobby?.team?._id, user]);

    const teacherGpsRemainingSeconds = useMemo(() => {
        if (!lobby?.teacherGps?.expiresAt) return null;

        const expiresAt = new Date(lobby.teacherGps.expiresAt).getTime();
        if (!Number.isFinite(expiresAt)) return null;

        return Math.max(0, Math.ceil((expiresAt - now) / 1000));
    }, [lobby?.teacherGps?.expiresAt, now]);

    const isTeacherGpsLocallyReady = Boolean(lobby?.teacherGps?.isReady && teacherGpsRemainingSeconds !== 0);
    const isPendingCheckInExpired = Boolean(lobby?.checkIn?.isPending && teacherGpsRemainingSeconds === 0);
    const effectiveCheckInStatus = isPendingCheckInExpired ? null : lobby?.checkIn?.status;
    const hasCheckedIn = effectiveCheckInStatus === 'passed';

    const checkInBadge = useMemo(() => {
        if (!effectiveCheckInStatus) {
            return isTeacherGpsLocallyReady
                ? <span className="badge success">Ready</span>
                : <span className="badge">Waiting</span>;
        }
        if (effectiveCheckInStatus === 'passed') return <span className="badge success">Checked in</span>;
        return <span className="badge danger">Failed</span>;
    }, [effectiveCheckInStatus, isTeacherGpsLocallyReady]);

    const teacherGpsMessage = useMemo(() => {
        if (effectiveCheckInStatus === 'passed') {
            return 'GPS check-in completed successfully.';
        }

        if (effectiveCheckInStatus === 'failed') {
            return 'Check-in failed. You can try again.';
        }

        if (lobby?.teacherGps?.status === 'ready' && teacherGpsRemainingSeconds === 0) {
            return 'Waiting for the teacher to set classroom GPS.';
        }

        if (lobby?.teacherGps?.status === 'ready') {
            return 'Classroom GPS is active. Check in now.';
        }

        if (lobby?.teacherGps?.status === 'expired') {
            return 'Waiting for the teacher to set classroom GPS.';
        }

        return 'Waiting for the teacher to set classroom GPS.';
    }, [effectiveCheckInStatus, lobby?.teacherGps?.status, teacherGpsRemainingSeconds]);

    const teacherGpsCountdown = useMemo(() => {
        if (hasCheckedIn) return null;
        if (teacherGpsRemainingSeconds === null) return null;

        return isTeacherGpsLocallyReady
            ? `Expires in ${formatCountdown(teacherGpsRemainingSeconds)}`
            : null;
    }, [hasCheckedIn, isTeacherGpsLocallyReady, teacherGpsRemainingSeconds]);

    const handleCheckIn = async () => {
        try {
            const pos = await getPosition();
            await request.post('/student/ready', {
                lat: pos.lat,
                lng: pos.lng
            });

            await fetchLobby();
        } catch {
            await fetchLobby();
        }
    };

    const handleCreateTeam = async () => {
        setTeamMsg('');

        if (!hasCheckedIn) {
            return;
        }

        setCreatingTeam(true);

        try {
            const res = await request.post('/student/team');
            setTeamMsg('');
            updateUser({ teamId: res.team?._id || null, team: res.team || null });
            await fetchLobby();
        } catch (error) {
            setTeamMsg(error.message);
        } finally {
            setCreatingTeam(false);
        }
    };

    const handleJoinTeam = async (event) => {
        event.preventDefault();
        setTeamMsg('');

        if (!hasCheckedIn) {
            return;
        }

        setJoiningTeam(true);

        try {
            const res = await request.post('/student/team/join', { teamId: teamIdInput });
            setTeamMsg('');
            setTeamIdInput('');
            updateUser({ teamId: res.team?._id || null, team: res.team || null });
            await fetchLobby();
        } catch (error) {
            setTeamMsg(error.message);
        } finally {
            setJoiningTeam(false);
        }
    };

    const handleDissolveTeam = async () => {
        setTeamMsg('');

        if (!lobby?.team?.isLeader) {
            return;
        }

        if (lobby.team.lockedAt) {
            setTeamMsg('This team has already entered the test and can no longer be dissolved.');
            return;
        }

        setDissolvingTeam(true);

        try {
            await request.delete('/student/team');
            setTeamMsg('');
            setTeamIdInput('');
            updateUser({ teamId: null, team: null });
            await fetchLobby();
        } catch (error) {
            setTeamMsg(error.message);
            await fetchLobby();
        } finally {
            setDissolvingTeam(false);
        }
    };

    const handleStartTest = () => {
        if (!lobby?.activeTest) {
            return;
        }

        if (!lobby?.team) {
            return;
        }

        navigate(`/student/test/${lobby.activeTest.id}`);
    };

    const feedbackEnabled = lobby?.feedback?.available && !lobby?.feedback?.submitted;
    const isTeamReady = Boolean(lobby?.team?.isReady);
    const canStartTeamTest = Boolean(hasCheckedIn && isTeamReady && lobby?.activeTest);
    const teamTestMessage = useMemo(() => {
        if (lobby?.activeTest && !lobby?.team) {
            return 'The teacher has published the test. Please complete team creation before starting.';
        }

        if (lobby?.activeTest && !lobby?.team?.isReady) {
            return 'The teacher has published the test. Wait until your team has 3 to 4 students before starting.';
        }

        if (lobby?.activeTest) {
            return 'The teacher has published the test. You can start now.';
        }

        return 'The teacher has not published the test yet. Please wait.';
    }, [lobby?.activeTest, lobby?.team]);

    const teamActionBusy = creatingTeam || joiningTeam || dissolvingTeam;
    const displayTeamId = lobby?.team?.teamId || '';

    if (loading) {
        return <main className="app-shell">Loading lobby...</main>;
    }

    return (
        <main className="app-shell">
            <header className="topbar">
                <div>
                    <h1>Student Dashboard</h1>
                    <p className="subtitle">{user?.name} - {user?.upi}</p>
                </div>
                <button className="btn ghost" onClick={logout}>Sign Out</button>
            </header>

            <section className="grid student-dashboard-steps">
                <article className="card stack">
                    <div className="row">
                        <h2>Step 1: Check-in</h2>
                        <div className="spacer" />
                        {checkInBadge}
                    </div>
                    <p className="muted">{teacherGpsMessage}</p>
                    {teacherGpsCountdown && <p className="muted">{teacherGpsCountdown}</p>}
                    <button
                        className="btn step-action-button"
                        onClick={handleCheckIn}
                        disabled={hasCheckedIn || isLocating || !isTeacherGpsLocallyReady}
                    >
                        Check In with GPS
                    </button>
                    {geoError && <div className="error">{geoError}</div>}
                </article>

                <article className="card stack">
                    <div className="row">
                        <h2>Step 2: Team Creation</h2>
                        <div className="spacer" />
                        <span className={isTeamReady ? 'badge success' : 'badge'}>
                            {lobby?.team ? isTeamReady ? 'Ready' : 'Waiting for members' : 'Open'}
                        </span>
                    </div>
                    <p className="muted">
                        {!hasCheckedIn && 'Please complete GPS check-in before starting. '}
                        Only one device in your team needs to create the Team ID. Other members should enter the same Team ID to join. Teams must have 3-4 students.
                    </p>

                    {lobby?.team ? (
                        <div className="stack">
                            <div className="panel team-id-panel">
                                <span className="muted">Team ID</span>
                                <strong>{displayTeamId}</strong>
                            </div>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>UPI</th>
                                        <th>Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lobby.team.members?.map((member) => {
                                        const leaderId = lobby.team.leaderId?._id || lobby.team.leaderId;
                                        const isLeader = leaderId?.toString() === member._id?.toString();
                                        return (
                                            <tr key={member.upi}>
                                                <td>{member.name}</td>
                                                <td>{member.upi}</td>
                                                <td>{isLeader ? 'Leader' : 'Member'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {lobby.team.isLeader && (
                                <button
                                    className="btn danger step-action-button"
                                    type="button"
                                    disabled={teamActionBusy || Boolean(lobby.team.lockedAt)}
                                    onClick={handleDissolveTeam}
                                >
                                    {dissolvingTeam ? 'Dissolving...' : 'Dissolve Team'}
                                </button>
                            )}
                            {lobby.team.isLeader && lobby.team.lockedAt && (
                                <div className="muted">This team has entered the test and can no longer be dissolved.</div>
                            )}
                            {teamMsg && <div className="error">{teamMsg}</div>}
                        </div>
                    ) : (
                        <div className="stack">
                            <form className="row wrap team-id-form" onSubmit={handleJoinTeam}>
                                <input
                                    className="field team-id-input"
                                    inputMode="numeric"
                                    maxLength={8}
                                    placeholder="Team ID"
                                    value={teamIdInput}
                                    onChange={(event) => setTeamIdInput(event.target.value.replace(/\D/g, '').slice(0, 8))}
                                    disabled={!hasCheckedIn || teamActionBusy}
                                    required
                                />
                                <button className="btn" type="submit" disabled={!hasCheckedIn || teamActionBusy || teamIdInput.length !== 8}>
                                    {joiningTeam ? 'Joining...' : 'Join Team'}
                                </button>
                                <button
                                    className="btn team-id-create-button"
                                    type="button"
                                    disabled={!hasCheckedIn || teamActionBusy}
                                    onClick={handleCreateTeam}
                                >
                                    {creatingTeam ? 'Creating...' : 'Create Team ID'}
                                </button>
                            </form>
                            {teamMsg && <div className="error">{teamMsg}</div>}
                        </div>
                    )}
                </article>

                <article className="card stack">
                    <div className="row">
                        <h2>Step 3: Team Test</h2>
                        <div className="spacer" />
                        <span className={lobby?.activeTest ? 'badge success' : 'badge warning'}>
                            {lobby?.activeTest ? 'Published' : 'Waiting'}
                        </span>
                    </div>
                    <p className="muted">{teamTestMessage}</p>
                    <button
                        className="btn step-action-button"
                        onClick={handleStartTest}
                        disabled={!canStartTeamTest}
                    >
                        Start Team Test
                    </button>
                </article>

                <article className="card stack">
                    <div className="row">
                        <h2>Step 4: Feedback</h2>
                        <div className="spacer" />
                        <span className={feedbackEnabled ? 'badge success' : 'badge'}>
                            {lobby?.feedback?.submitted ? 'Submitted' : feedbackEnabled ? 'Open' : 'Locked'}
                        </span>
                    </div>
                    <p className="muted">
                        {lobby?.feedback?.submitted
                            ? 'Feedback has already been submitted for this test.'
                            : feedbackEnabled
                                ? `Open until ${new Date(lobby.feedback.closesAt).toLocaleTimeString()}`
                                : 'Available for 10 minutes after a completed test.'}
                    </p>
                    <button
                        className="btn step-action-button"
                        disabled={!feedbackEnabled}
                        onClick={() => navigate(`/student/feedback/${lobby.feedback.testId}`)}
                    >
                        Give Teacher Feedback
                    </button>
                </article>
            </section>
        </main>
    );
}
