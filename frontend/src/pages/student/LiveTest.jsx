import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import request from '../../api/request';

export default function StudentLiveTest() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const { user } = useAuth();

    const [team, setTeam] = useState(user?.team || null);
    const [isOperator, setIsOperator] = useState(false);
    const [currentSeq, setCurrentSeq] = useState(1);
    const [totalQuestions, setTotalQuestions] = useState(1);
    const [question, setQuestion] = useState(null);
    const [attempts, setAttempts] = useState(0);
    const [optionStates, setOptionStates] = useState({});
    const [isLocked, setIsLocked] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    const teamId = team?._id || user?.teamId;
    const progress = Math.min((currentSeq / Math.max(totalQuestions, 1)) * 100, 100);
    const remainingAttempts = isLocked ? 0 : Math.max(3 - attempts, 0);

    const fetchTeam = async () => {
        if (teamId) return teamId;
        const res = await request.get('/student/team-info');
        if (res.success && res.team) {
            setTeam(res.team);
            return res.team._id;
        }
        return null;
    };

    const fetchQuestionAndLock = async () => {
        setLoading(true);
        setMessage('');

        try {
            const currentTeamId = teamId || await fetchTeam();
            if (!currentTeamId) {
                setMessage('Please finish teaming before entering the test.');
                return;
            }

            const res = await request.get(`/student/question?testId=${testId}&teamId=${currentTeamId}`);
            if (res.success) {
                setIsOperator(res.isOperator);
                setCurrentSeq(res.currentSeq);
                setTotalQuestions(res.totalQuestions);
                setQuestion(res.question);
                setTeam(res.team);
                setOptionStates({});
                setAttempts(0);
                setIsLocked(false);
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestionAndLock();
    }, [testId, teamId]);

    useEffect(() => {
        if (!socket) return undefined;

        const handleChangeQuestion = (data) => {
            if (data.testId === testId) {
                fetchQuestionAndLock();
            }
        };

        const handleTestEnded = (data) => {
            if (data.testId === testId) {
                setMessage('The test has ended. Returning to the lobby...');
                setTimeout(() => navigate('/student/dashboard'), 800);
            }
        };

        socket.on('CHANGE_QUESTION', handleChangeQuestion);
        socket.on('TEST_ENDED', handleTestEnded);

        return () => {
            socket.off('CHANGE_QUESTION', handleChangeQuestion);
            socket.off('TEST_ENDED', handleTestEnded);
        };
    }, [socket, testId, navigate, teamId]);

    const handleOptionSelect = async (selectedOption) => {
        if (!isOperator || isLocked || optionStates[selectedOption] === 'wrong') return;

        try {
            const res = await request.post('/student/answer', {
                testId,
                teamId,
                seq: currentSeq,
                selectedOption
            });

            if (res.success) {
                setAttempts(res.attempts);

                if (res.isCorrect) {
                    setOptionStates((prev) => ({ ...prev, [selectedOption]: 'correct' }));
                    setIsLocked(true);
                    setMessage(`Correct. Score earned: ${res.scoreEarned}. Wait for the next question.`);
                } else if (res.isExhausted) {
                    setIsLocked(true);
                    setOptionStates((prev) => ({
                        ...prev,
                        [selectedOption]: 'wrong'
                    }));
                    setMessage('No attempts left. Wait for the next question.');
                } else {
                    setOptionStates((prev) => ({ ...prev, [selectedOption]: 'wrong' }));
                    setMessage('Incorrect. Please try again.');
                }
            }
        } catch (error) {
            setMessage(error.message);
        }
    };

    const options = useMemo(() => question?.options || {}, [question]);

    const renderOption = ([key, value]) => {
        const state = optionStates[key];
        const className = [
            'btn',
            'option-btn',
            state === 'correct' ? 'correct' : '',
            state === 'wrong' ? 'wrong' : ''
        ].filter(Boolean).join(' ');

        return (
            <button
                key={key}
                className={className}
                onClick={() => handleOptionSelect(key)}
                disabled={!isOperator || isLocked || state === 'wrong'}
            >
                <span className="option-letter">{key}</span>
                <span>{value}</span>
            </button>
        );
    };

    const renderReadOnlyOption = ([key, value]) => (
        <button key={key} className="btn option-btn readonly-option" type="button" disabled>
            <span className="option-letter">{key}</span>
            <span>{value}</span>
        </button>
    );

    if (loading) {
        return <main className="app-shell">Loading test...</main>;
    }

    return (
        <main className="app-shell narrow">
            <header className="topbar">
                <div>
                    <h1>Question {currentSeq}</h1>
                    <p className="subtitle">Question {currentSeq} of {totalQuestions}</p>
                    <p className="muted">
                        {isOperator
                            ? 'Leader device can submit answers for the team.'
                            : 'Member devices are read-only.'}
                    </p>
                </div>
                <span className={isOperator ? 'badge success' : 'badge'}>{isOperator ? 'Leader Device' : 'Member Device'}</span>
            </header>

            <div className="card stack">
                <div className="progress" aria-label="Question progress">
                    <span style={{ width: `${progress}%` }} />
                </div>

                {!isOperator ? (
                    <div className="option-grid">
                        {Object.entries(options).map(renderReadOnlyOption)}
                    </div>
                ) : (
                    <div className="stack">
                        <div className="option-grid">
                            {Object.entries(options).map(renderOption)}
                        </div>
                        <p className="muted">Attempts remaining: {remainingAttempts}</p>
                    </div>
                )}

                {message && (
                    <div className={message.startsWith('Correct') ? 'success' : message.startsWith('Incorrect') || message.startsWith('No attempts') ? 'error' : 'status-text'}>
                        {message}
                    </div>
                )}
            </div>
        </main>
    );
}
