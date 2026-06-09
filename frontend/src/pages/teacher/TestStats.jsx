import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import request from '../../api/request';
import { useSocket } from '../../hooks/useSocket';
import { apiUrl } from '../../config/endpoints';

const rateToNumber = (value) => Number.parseFloat((value || '0').replace('%', '')) || 0;

const getSafeFileName = (value) => (
    (value || 'Untitled Test')
        .toString()
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
    || 'Untitled_Test'
);

export default function TestStats() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await request.get(`/tests/${testId}/statistics`);
                if (res.success) setStats(res.statistics);
            } catch (error) {
                setMessage(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [testId]);

    useEffect(() => {
        if (!socket) return undefined;

        const handleNewFeedback = (data) => {
            if (data.testId?.toString() !== testId) return;

            setStats((current) => {
                if (!current) return current;

                const nextFeedback = {
                    studentName: data.name || 'Unknown student',
                    upi: data.upi || 'N/A',
                    content: data.content,
                    submittedAt: data.timestamp || new Date().toISOString()
                };
                const existingFeedbacks = current.feedbacks || [];
                const withoutDuplicate = existingFeedbacks.filter((item) => item.upi !== nextFeedback.upi);

                return {
                    ...current,
                    feedbacks: [nextFeedback, ...withoutDuplicate]
                };
            });
        };

        socket.on('NEW_FEEDBACK_RECEIVED', handleNewFeedback);
        return () => socket.off('NEW_FEEDBACK_RECEIVED', handleNewFeedback);
    }, [socket, testId]);

    const handleExport = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios({
                url: apiUrl(`/tests/${testId}/export`),
                method: 'GET',
                responseType: 'blob',
                headers: { Authorization: `Bearer ${token}` }
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `test_results_${getSafeFileName(stats?.test?.name)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            window.alert('Export failed.');
        }
    };

    if (loading) {
        return <main className="app-shell">Loading results...</main>;
    }

    if (!stats) {
        return (
            <main className="app-shell">
                <button className="btn ghost" onClick={() => navigate('/teacher/dashboard')}>Back</button>
                <p className="status-text">{message || 'No result data.'}</p>
            </main>
        );
    }

    const counts = stats.overview.checkInCounts;

    return (
        <main className="app-shell">
            <header className="topbar">
                <div>
                    <h1>Test Results</h1>
                    <p className="subtitle">{testId}</p>
                </div>
                <div className="row wrap">
                    <button className="btn secondary" onClick={() => navigate('/teacher/dashboard')}>Back</button>
                    <button className="btn" onClick={handleExport}>Export File</button>
                </div>
            </header>

            <section className="grid three" style={{ marginBottom: 18 }}>
                <article className="card">
                    <h3>Teams</h3>
                    <strong style={{ fontSize: 32 }}>{stats.overview.totalTeams}</strong>
                </article>
                <article className="card">
                    <h3>Checked In</h3>
                    <strong style={{ fontSize: 32 }}>{counts.passed}</strong>
                    <p className="subtitle">{counts.failed} failed - {counts.missing} missing</p>
                </article>
                <article className="card">
                    <h3>Questions</h3>
                    <strong style={{ fontSize: 32 }}>{stats.test.questionCount}</strong>
                </article>
            </section>

            <section className="card stack" style={{ marginBottom: 18 }}>
                <h2>Question Performance</h2>
                <div className="scroll-area question-performance-scroll">
                    {stats.questions.map((question) => (
                        <div className="panel stack" key={question.seq}>
                            <div className="row wrap">
                                <strong>Question {question.seq}</strong>
                                <span className="badge">Answer {question.correctAnswer || 'N/A'}</span>
                                <span className="muted">{question.totalFinalized} finalized teams</span>
                            </div>
                            {['A', 'B', 'C', 'D'].map((key) => (
                                <div key={key} className="muted">{key}. {question.options[key]}</div>
                            ))}
                            {[
                                ['First try', question.rates.firstTry],
                                ['Second try', question.rates.secondTry],
                                ['Third try', question.rates.thirdTry],
                                ['Incorrect', question.rates.incorrect]
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <div className="row">
                                        <span style={{ width: 100 }}>{label}</span>
                                        <span className="muted">{value}</span>
                                    </div>
                                    <div className="progress">
                                        <span style={{ width: `${rateToNumber(value)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </section>

            <section className="card stack" style={{ marginBottom: 18 }}>
                <h2>Team Scores</h2>
                <div className="table-shell scroll-area">
                    <table className="table roster-table team-score-table">
                        <thead>
                            <tr>
                                <th>Team ID</th>
                                <th>Leader</th>
                                <th>Members</th>
                                <th>Score</th>
                                <th>Answered</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.teamResults.map((team) => (
                                <tr key={team.teamObjectId}>
                                    <td>{team.teamId}</td>
                                    <td>{team.leader?.name || 'N/A'}</td>
                                    <td>{team.members?.map((member) => member.upi).join(', ')}</td>
                                    <td>{team.totalScore}</td>
                                    <td>{team.answeredQuestions}</td>
                                </tr>
                            ))}
                            {stats.teamResults.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="empty-table-cell">
                                        <div className="empty-state">
                                            <strong>No team results yet.</strong>
                                            <span>Results will appear after teams submit answers.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card stack">
                <div className="row wrap">
                    <h2>Feedback</h2>
                    <span className="spacer" />
                    <span className="badge success">Live</span>
                </div>
                <div className="scroll-area feedback-scroll">
                    {stats.feedbacks.length > 0 ? stats.feedbacks.map((item, index) => (
                        <div className="panel" key={`${item.upi}-${index}`}>
                            <strong>{item.studentName} - {item.upi}</strong>
                            <p>{item.content}</p>
                        </div>
                    )) : <p className="muted">No feedback submitted.</p>}
                </div>
            </section>
        </main>
    );
}
