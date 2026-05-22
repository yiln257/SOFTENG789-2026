import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../api/request';

export default function StudentFeedback() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [feedbackText, setFeedbackText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [lobby, setLobby] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchLobby = async () => {
            try {
                const res = await request.get('/student/lobby');
                setLobby(res);
                if (!res.feedback?.available || res.feedback.testId?.toString() !== testId) {
                    setMessage('Feedback is not open for this test.');
                }
            } catch (error) {
                setMessage(error.message);
            }
        };
        fetchLobby();
    }, [testId]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const remainingSeconds = useMemo(() => {
        if (!lobby?.feedback?.closesAt) return 0;
        return Math.max(0, Math.floor((new Date(lobby.feedback.closesAt).getTime() - now) / 1000));
    }, [lobby, now]);

    const isOpen = lobby?.feedback?.available && lobby.feedback.testId?.toString() === testId && remainingSeconds > 0;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!feedbackText.trim()) return;

        setLoading(true);
        setMessage('');

        try {
            const res = await request.post('/student/feedback', {
                testId,
                feedback: feedbackText
            });
            setIsSubmitted(true);
            setMessage(res.message || 'Feedback submitted successfully.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="app-shell narrow">
            <header className="topbar">
                <div>
                    <h1>Feedback</h1>
                    <p className="subtitle">{isOpen ? `${remainingSeconds}s remaining` : 'Closed'}</p>
                </div>
                <button className="btn ghost" onClick={() => navigate('/student/dashboard')}>Back to Lobby</button>
            </header>

            <section className="card">
                {isSubmitted ? (
                    <div className="stack">
                        <span className="badge success">Submitted</span>
                        <p className="success">{message}</p>
                    </div>
                ) : (
                    <form className="stack" onSubmit={handleSubmit}>
                        <textarea
                            className="field"
                            value={feedbackText}
                            onChange={(event) => setFeedbackText(event.target.value)}
                            placeholder="Enter your feedback"
                            rows={8}
                            disabled={!isOpen || loading}
                        />
                        <button className="btn" type="submit" disabled={!isOpen || loading || !feedbackText.trim()}>
                            {loading ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                        {message && <p className="status-text">{message}</p>}
                    </form>
                )}
            </section>
        </main>
    );
}
