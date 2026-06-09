import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useGeoLocation } from '../../hooks/useGeoLocation';
import request from '../../api/request';

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
    const [teamIdInput, setTeamIdInput] = useState('');

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

    const checkInBadge = useMemo(() => {
        if (!lobby?.checkIn) return <span className="badge">Not checked in</span>;
        if (lobby.checkIn.status === 'passed') return <span className="badge success">Checked in</span>;
        return <span className="badge danger">Failed</span>;
    }, [lobby]);

    const teacherGpsMessage = useMemo(() => {
        if (lobby?.teacherGps?.status === 'ready') {
            return 'The teacher has set the classroom GPS point. You can check in now.';
        }

        if (lobby?.teacherGps?.status === 'expired') {
            return 'The classroom GPS point has expired. Please wait for the teacher to refresh it before checking in.';
        }

        return 'The teacher has not set the classroom GPS point yet. Please wait before checking in.';
    }, [lobby?.teacherGps?.status]);

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
        setCreatingTeam(true);

        try {
            const res = await request.post('/student/team');
            setTeamMsg(res.message || 'Team ID created.');
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
        setJoiningTeam(true);

        try {
            const res = await request.post('/student/team/join', { teamId: teamIdInput });
            setTeamMsg(res.message || 'Joined team.');
            setTeamIdInput('');
            updateUser({ teamId: res.team?._id || null, team: res.team || null });
            await fetchLobby();
        } catch (error) {
            setTeamMsg(error.message);
        } finally {
            setJoiningTeam(false);
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
    const canStartTeamTest = Boolean(isTeamReady && lobby?.activeTest);
    const hasCheckedIn = lobby?.checkIn?.status === 'passed';
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

    const teamActionBusy = creatingTeam || joiningTeam;
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
                        <h2>Step 1: Team Creation</h2>
                        <div className="spacer" />
                        <span className={isTeamReady ? 'badge success' : 'badge'}>
                            {lobby?.team ? isTeamReady ? 'Ready' : 'Waiting for members' : 'Open'}
                        </span>
                    </div>
                    <p className="muted">
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
                                    required
                                />
                                <button className="btn" type="submit" disabled={teamActionBusy || teamIdInput.length !== 8}>
                                    {joiningTeam ? 'Joining...' : 'Join Team'}
                                </button>
                                <button
                                    className="btn team-id-create-button"
                                    type="button"
                                    disabled={teamActionBusy}
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
                        <h2>Step 2: Check-in</h2>
                        <div className="spacer" />
                        {checkInBadge}
                    </div>
                    <p className="muted">{teacherGpsMessage}</p>
                    <button
                        className="btn step-action-button"
                        onClick={handleCheckIn}
                        disabled={hasCheckedIn || isLocating || !lobby?.teacherGps?.isReady}
                    >
                        Check In with GPS
                    </button>
                    {geoError && <div className="error">{geoError}</div>}
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
