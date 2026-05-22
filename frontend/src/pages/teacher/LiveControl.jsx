import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../api/request';

export default function TeacherLiveControl() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [test, setTest] = useState(null);
    const [message, setMessage] = useState('');

    const fetchTest = async () => {
        try {
            const res = await request.get(`/tests/${testId}`);
            if (res.success) setTest(res.test);
        } catch (error) {
            setMessage(error.message);
        }
    };

    useEffect(() => {
        fetchTest();
    }, [testId]);

    const progress = useMemo(() => {
        if (!test?.questionCount) return 0;
        return Math.min((test.currentQuestionSeq / test.questionCount) * 100, 100);
    }, [test]);

    const isFinalQuestion = test?.currentQuestionSeq >= test?.questionCount;

    const handleNextQuestion = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await request.post(`/tests/${testId}/next`);
            if (res.ended) {
                setMessage(res.message);
                setTimeout(() => navigate('/teacher/dashboard'), 800);
                return;
            }
            setTest((current) => ({
                ...current,
                currentQuestionSeq: res.currentSeq,
                questionCount: res.totalQuestions
            }));
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!test) {
        return <main className="app-shell narrow">Loading control panel...</main>;
    }

    return (
        <main className="app-shell narrow">
            <header className="topbar">
                <div>
                    <h1>Live Control</h1>
                    <p className="subtitle">Question {test.currentQuestionSeq} of {test.questionCount}</p>
                </div>
                <span className="badge success">{test.status === 'published' ? 'Live' : test.status}</span>
            </header>

            <section className="card stack">
                <div className="progress" aria-label="Question progress">
                    <span style={{ width: `${progress}%` }} />
                </div>

                <button className="btn" onClick={handleNextQuestion} disabled={loading || test.status !== 'published'}>
                    {isFinalQuestion ? 'End Test' : 'Next Question'}
                </button>

                {message && <p className="status-text">{message}</p>}
            </section>
        </main>
    );
}
