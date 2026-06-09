import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useGeoLocation } from '../../hooks/useGeoLocation';
import request from '../../api/request';

const emptyMate = () => ({ upi: '', password: '' });

export default function StudentDashboard() {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();
    const { getPosition, isLocating, geoError } = useGeoLocation();

    const [lobby, setLobby] = useState(null);
    const [loading, setLoading] = useState(true);
    const [teamMsg, setTeamMsg] = useState('');
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [teammates, setTeammates] = useState([emptyMate(), emptyMate()]);

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

    const updateMate = (index, field, value) => {
        setTeammates((current) => current.map((mate, i) => (
            i === index ? { ...mate, [field]: value } : mate
        )));
    };

    const handleCreateTeam = async (event) => {
        event.preventDefault();
        setTeamMsg('');
        setCreatingTeam(true);

        try {
            const payload = teammates.map((mate) => ({
                upi: mate.upi.trim(),
                password: mate.password
            }));
            const res = await request.post('/student/team', { teammates: payload });
            setTeamMsg(res.message || 'Team created successfully.');
            updateUser({ teamId: res.team?._id || null, team: res.team || null });
            await fetchLobby();
        } catch (error) {
            setTeamMsg(error.message);
        } finally {
            setCreatingTeam(false);
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
    const canStartTeamTest = Boolean(lobby?.team && lobby?.activeTest);
    const hasCheckedIn = lobby?.checkIn?.status === 'passed';
    const teamTestMessage = useMemo(() => {
        if (lobby?.activeTest && !lobby?.team) {
            return 'The teacher has published the test. Please complete team creation before starting.';
        }

        if (lobby?.activeTest) {
            return 'The teacher has published the test. You can start now.';
        }

        return 'The teacher has not published the test yet. Please wait.';
    }, [lobby?.activeTest, lobby?.team]);

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
                        <h2>Step 2: Team Creation</h2>
                        <div className="spacer" />
                        <span className={lobby?.team ? 'badge success' : 'badge'}>{lobby?.team ? 'Ready' : 'Open'}</span>
                    </div>
                    <p className="muted">Choose one device as your team's leader device to enter the teammates' details below. Each member should enter their own password to keep it private.</p>

                    {lobby?.team ? (
                        <div className="stack">
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
                        <form className="stack" onSubmit={handleCreateTeam}>
                            {teammates.map((mate, index) => (
                                <div className="row teammate-fields" key={index}>
                                    <input
                                        className="field"
                                        placeholder={`Teammate ${index + 1} UPI`}
                                        value={mate.upi}
                                        onChange={(event) => updateMate(index, 'upi', event.target.value)}
                                        required
                                    />
                                    <input
                                        className="field"
                                        type="password"
                                        placeholder="Password"
                                        value={mate.password}
                                        onChange={(event) => updateMate(index, 'password', event.target.value)}
                                        required
                                    />
                                </div>
                            ))}
                            <div className="row wrap">
                                <button
                                    className="btn secondary teammate-stepper-button"
                                    type="button"
                                    aria-label="Add teammate"
                                    disabled={teammates.length >= 3}
                                    onClick={() => setTeammates((current) => [...current, emptyMate()])}
                                >
                                    +
                                </button>
                                <button
                                    className="btn ghost teammate-stepper-button"
                                    type="button"
                                    aria-label="Remove teammate"
                                    disabled={teammates.length <= 2}
                                    onClick={() => setTeammates((current) => current.slice(0, -1))}
                                >
                                    -
                                </button>
                                <button className="btn" type="submit" disabled={creatingTeam}>
                                    {creatingTeam ? 'Creating...' : 'Create Team'}
                                </button>
                            </div>
                            {teamMsg && <div className="error">{teamMsg}</div>}
                        </form>
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
                        Open Feedback
                    </button>
                </article>
            </section>
        </main>
    );
}
