import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../api/request';

export default function TeacherLiveControl() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // 切换下一题 (如果到达最后一题，后端会自动判断并触发 enter_feedback)
    const handleNextQuestion = async () => {
        setLoading(true);
        try {
            const res = await request.post(`/tests/${testId}/next`);
            alert(res.message || '已通知全员切换题目/进入反馈');
        } catch (err) {
            alert('操作失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // 结束测试 (强制全员踢回大厅)
    const handleCloseTest = async () => {
        if (!window.confirm('确定要强行结束本次测试吗？所有学生将被踢回大厅。')) return;
        setLoading(true);
        try {
            await request.post(`/tests/${testId}/close`);
            alert('测试已结束');
            navigate('/teacher/dashboard');
        } catch (err) {
            alert('结束失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '30px', maxWidth: '600px', margin: '50px auto', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
            <h2 style={{ color: '#d9534f' }}>🔴 考试直播主控台</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>试卷 ID: {testId}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button 
                    onClick={handleNextQuestion} 
                    disabled={loading}
                    style={{ padding: '15px', fontSize: '18px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    ⏭️ 切换下一题 / 触发 Feedback
                </button>
                
                <button 
                    onClick={handleCloseTest} 
                    disabled={loading}
                    style={{ padding: '15px', fontSize: '18px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                    🛑 强制结束测试
                </button>
            </div>
            <p style={{ fontSize: '12px', marginTop: '20px', color: '#999' }}>* 提示：题目内容请通过线下 PPT 展示，学生端仅显示选项</p>
        </div>
    );
}