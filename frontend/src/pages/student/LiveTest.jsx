import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import request from '../../api/request';

export default function StudentLiveTest() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const { user } = useAuth();

    const [isOperator, setIsOperator] = useState(false); 
    const [currentSeq, setCurrentSeq] = useState(1); 
    const [attempts, setAttempts] = useState(0); 
    const [optionStates, setOptionStates] = useState({}); 
    const [isLocked, setIsLocked] = useState(false); 

    const teamId = user?.team?._id || user?.teamId || user?.team; 
    const studentId = user?.id || user?._id;

    // --- 核心动作 1：获取本题状态与抢锁 ---
    const fetchQuestionAndLock = async () => {
        if (!testId || !teamId || !studentId) return;
        try {
            const res = await request.get(`/student/question?testId=${testId}&teamId=${teamId}&studentId=${studentId}`);
            
            if (res.success) {
                setIsOperator(res.isOperator);
                setCurrentSeq(res.currentSeq);
                // 每次获取新题时，清空之前的选项状态
                setOptionStates({});
                setAttempts(0);
                setIsLocked(false);
            }
        } catch (err) {
            console.error('获取题目失败', err);
        }
    };

    // 初始化时获取一次题目
    useEffect(() => {
        fetchQuestionAndLock();
    }, [testId, teamId, studentId]);

    // --- 核心动作 2：监听老师切换题目的 Socket 广播 ---
    useEffect(() => {
        if (!socket) return;

        const handleChangeQuestion = (data) => {
            if (data.testId === testId) {
                fetchQuestionAndLock();
            }
        };

        const handleEnterFeedback = (data) => {
            if (data.testId === testId) {
                navigate(`/student/feedback/${testId}`);
            }
        };

        // 🚨 新增：如果学生还在答题页面挂机，老师强制结束测试时，直接踢回大厅
        const handleTestEnded = (data) => {
            if (data.testId === testId) {
                alert('教师已强行结束本次测试，系统将带您返回大厅。');
                navigate('/student/dashboard');
            }
        };

        socket.on('CHANGE_QUESTION', handleChangeQuestion);
        socket.on('ENTER_FEEDBACK', handleEnterFeedback);
        socket.on('TEST_ENDED', handleTestEnded);

        return () => {
            socket.off('CHANGE_QUESTION', handleChangeQuestion);
            socket.off('ENTER_FEEDBACK', handleEnterFeedback);
            socket.off('TEST_ENDED', handleTestEnded);
        };
    }, [socket, testId, navigate]);

    // --- 核心动作 3：提交选项（刮刮乐机制） ---
    const handleOptionSelect = async (selectedOption) => {
        if (!isOperator || isLocked || optionStates[selectedOption] === 'wrong') return;

        try {
            const res = await request.post('/student/answer', {
                testId,
                teamId,
                studentId,
                seq: currentSeq,
                selectedOption
            });

            if (res.success) {
                setAttempts(res.attempts);
                
                if (res.isCorrect) {
                    // 答对：将该选项标绿，并锁定本题
                    setOptionStates(prev => ({ ...prev, [selectedOption]: 'correct' }));
                    setIsLocked(true);
                } else {
                    // 答错：将该选项置灰
                    setOptionStates(prev => ({ ...prev, [selectedOption]: 'wrong' }));
                    
                    // 如果错误次数达到3次（机会耗尽），则锁定题目，并标出正确答案
                    if (res.isExhausted && res.correctAnswer) {
                        setIsLocked(true);
                        setOptionStates(prev => ({ ...prev, [res.correctAnswer]: 'correct' }));
                    }
                }
            }
        } catch (err) {
            console.error('提交答案失败', err);
            alert(err.response?.data?.message || '提交失败');
        }
    };

    // 渲染 ABCD 四个选项按钮
    const renderOption = (optStr) => {
        let bgColor = '#f8f9fa';
        let color = '#333';

        if (optionStates[optStr] === 'correct') {
            bgColor = '#28a745'; // 绿色（对）
            color = 'white';
        } else if (optionStates[optStr] === 'wrong') {
            bgColor = '#e9ecef'; // 置灰（错）
            color = '#adb5bd';
        }

        return (
            <button
                key={optStr}
                onClick={() => handleOptionSelect(optStr)}
                disabled={!isOperator || isLocked || optionStates[optStr] === 'wrong'}
                style={{
                    padding: '20px', fontSize: '24px', margin: '10px',
                    width: '40%', borderRadius: '8px', border: '2px solid #007bff',
                    background: bgColor, color: color,
                    cursor: (!isOperator || isLocked || optionStates[optStr] === 'wrong') ? 'not-allowed' : 'pointer',
                    opacity: optionStates[optStr] === 'wrong' ? 0.5 : 1
                }}
            >
                {optStr}
            </button>
        );
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2>📝 第 {currentSeq} 题</h2>
            
            {/* ✨ 优化了非操作手（观看者）的提示文案 */}
            {!isOperator ? (
                <div style={{ padding: '50px', background: '#ffeeba', color: '#856404', borderRadius: '8px', fontSize: '20px', lineHeight: '1.5' }}>
                    📱 组内其他成员已最先通过 GPS 校验获得了答题设备。<br/><br/>
                    请与他共享屏幕看题，并一起讨论答案！
                </div>
            ) : (
                <div style={{ marginTop: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['A', 'B', 'C', 'D'].map(renderOption)}
                    </div>
                    {isLocked && <p style={{ color: 'green', marginTop: '20px', fontWeight: 'bold' }}>本题已作答完毕，请看屏幕等待老师切换下一题</p>}
                </div>
            )}
        </div>
    );
}