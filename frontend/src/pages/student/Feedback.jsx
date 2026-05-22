import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket'; // 确保你有这个自定义 hook
import request from '../../api/request';

export default function StudentFeedback() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const [feedbackText, setFeedbackText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false); // 标记是否成功提交

    // 🚨 核心逻辑：动态监听教师端“结束测试”的统一广播
    useEffect(() => {
        if (!socket) return;

        const handleTestEnded = (data) => {
            if (data.testId === testId) {
                alert('教师已宣布本次测试正式结束，系统将带您返回大厅。');
                navigate('/student/dashboard'); // 只有在收到教师端的事件时，才回大厅
            }
        };

        socket.on('TEST_ENDED', handleTestEnded);

        return () => {
            socket.off('TEST_ENDED', handleTestEnded);
        };
    }, [socket, testId, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!feedbackText.trim()) return alert('反馈内容不能为空');
        
        setLoading(true);
        try {
            await request.post('/student/feedback', {
                testId,
                feedback: feedbackText // 只给后端传这两个关键业务字段
            });
            setIsSubmitted(true); // 成功后切换 UI 状态，停留在当前页
        } catch (err) {
            alert('提交失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '50px auto' }}>
            <h2 style={{ textAlign: 'center' }}>📝 考后反馈与主观评价</h2>
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                
                {isSubmitted ? (
                    // 停留页面：提交成功后的展示状态
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <span style={{ fontSize: '60px', color: '#28a745' }}>✓</span>
                        <h3 style={{ marginTop: '15px', color: '#28a745' }}>提交成功！感谢参与。</h3>
                        <p style={{ color: '#666', fontSize: '14px', marginTop: '20px', lineHeight: '1.6' }}>
                            您的反馈已通过加密通道实时推送到教师大屏幕。<br />
                            请保持此界面，<strong>关注教室投影仪</strong>。当老师在控制台点击“结束测试”时，系统将自动带您安全返回大厅。
                        </p>
                    </div>
                ) : (
                    // 填写状态
                    <>
                        <p style={{ color: '#555', marginBottom: '15px' }}>
                            本次测试已结束。请您作为小组成员代表，填写对本次团队协作和测试题目的主观评价（选填）。
                        </p>
                        <form onSubmit={handleSubmit}>
                            <textarea 
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="请输入您的团队反馈..."
                                style={{ width: '100%', height: '150px', padding: '10px', boxSizing: 'border-box', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc', resize: 'none' }}
                                disabled={loading}
                            />
                            <button 
                                type="submit" 
                                disabled={loading || !feedbackText.trim()}
                                style={{ width: '100%', padding: '12px', background: feedbackText.trim() ? '#28a745' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: feedbackText.trim() ? 'pointer' : 'not-allowed', fontSize: '16px' }}
                            >
                                {loading ? '提交中...' : '提交反馈'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}