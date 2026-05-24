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
    const [statusMsg, setStatusMsg] = useState('');
    const [teamMsg, setTeamMsg] = useState('');
    const [startMsg, setStartMsg] = useState('');
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
            setStatusMsg(error.message);
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

        return () => {
            socket.off('TEAM_UPDATED', refresh);
            socket.off('TEST_STARTED', refresh);
            socket.off('TEST_ENDED', refresh);
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

    const handleCheckIn = async () => {
        setStatusMsg('');
        try {
            const pos = await getPosition();
            const res = await request.post('/student/ready', {
                lat: pos.lat,
                lng: pos.lng
            });

            setStatusMsg(res.message);
            await fetchLobby();
        } catch (error) {
            setStatusMsg(error.message);
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
        setStartMsg('');

        if (!lobby?.activeTest) {
            setStartMsg('Waiting for the teacher to publish the test.');
            return;
        }

        if (!lobby?.team) {
            setStartMsg('The test has been published. Please finish teaming first.');
            return;
        }

        if (!lobby.team.isLeader) {
            setStartMsg('The test has started. Please share the team leader device to answer.');
            return;
        }

        navigate(`/student/test/${lobby.activeTest.id}`);
    };

    const feedbackEnabled = lobby?.feedback?.available && !lobby?.feedback?.submitted;

    if (loading) {
        return <main className="app-shell">Loading lobby...</main>;
    }

    return (
        <main className="app-shell">
            <header className="topbar">
                <div>
                    <h1>Student Lobby</h1>
                    <p className="subtitle">{user?.name} - {user?.upi}</p>
                </div>
                <button className="btn ghost" onClick={logout}>Sign Out</button>
            </header>

            <section className="grid">
                <article className="card stack">
                    <div className="row">
                        <h2>Check-in</h2>
                        <div className="spacer" />
                        {checkInBadge}
                    </div>
                    <p className="muted">
                        {lobby?.activeTest
                            ? `Live test: ${lobby.activeTest.currentSeq} of ${lobby.activeTest.totalQuestions}`
                            : 'No live test has been published yet.'}
                    </p>
                    <button className="btn" onClick={handleCheckIn} disabled={isLocating}>
                        {isLocating ? 'Getting GPS...' : 'Check In with GPS'}
                    </button>
                    {geoError && <div className="error">{geoError}</div>}
                    {statusMsg && <p className="status-text">{statusMsg}</p>}
                </article>

                <article className="card stack">
                    <div className="row">
                        <h2>Team</h2>
                        <div className="spacer" />
                        <span className={lobby?.team ? 'badge success' : 'badge'}>{lobby?.team ? 'Ready' : 'Open'}</span>
                    </div>

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
                            {!lobby.team.isLeader && (
                                <p className="muted">Your team has been created. Teaming is locked for this test.</p>
                            )}
                        </div>
                    ) : (
                        <form className="stack" onSubmit={handleCreateTeam}>
                            {teammates.map((mate, index) => (
                                <div className="row" key={index}>
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
                                    className="btn secondary"
                                    type="button"
                                    disabled={teammates.length >= 3}
                                    onClick={() => setTeammates((current) => [...current, emptyMate()])}
                                >
                                    Add Teammate
                                </button>
                                <button
                                    className="btn ghost"
                                    type="button"
                                    disabled={teammates.length <= 2}
                                    onClick={() => setTeammates((current) => current.slice(0, -1))}
                                >
                                    Remove
                                </button>
                                <button className="btn" type="submit" disabled={creatingTeam}>
                                    {creatingTeam ? 'Creating...' : 'Create Team'}
                                </button>
                            </div>
                            {teamMsg && <p className="status-text">{teamMsg}</p>}
                        </form>
                    )}
                </article>

                <article className="card stack">
                    <div className="row">
                        <h2>Start Test</h2>
                        <div className="spacer" />
                        <span className={lobby?.activeTest ? 'badge success' : 'badge warning'}>
                            {lobby?.activeTest ? 'Published' : 'Waiting'}
                        </span>
                    </div>
                    <p className="muted">
                        {lobby?.team?.isLeader
                            ? 'Leader device'
                            : lobby?.team
                                ? 'Member device'
                                : 'No team yet'}
                    </p>
                    <button className="btn" onClick={handleStartTest}>Start Test</button>
                    {startMsg && <p className="status-text">{startMsg}</p>}
                </article>

                <article className="card stack">
                    <div className="row">
                        <h2>Feedback</h2>
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
                        className="btn"
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
