import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useGeoLocation } from '../../hooks/useGeoLocation';
import request from '../../api/request';

export default function StudentDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket(); 
    const { getPosition, isLocating, geoError } = useGeoLocation();

    const [teamInfo, setTeamInfo] = useState(null);
    const [statusMsg, setStatusMsg] = useState('请点击下方按钮进行考前准备');
    const [isReady, setIsReady] = useState(false); 

    // 1. 页面加载时获取本组信息
    useEffect(() => {
        const fetchTeamInfo = async () => {
            try {
                const res = await request.get('/student/team-info');
                if (res.success) setTeamInfo(res.team);
            } catch (err) {
                console.error('获取队伍信息失败', err);
            }
        };
        fetchTeamInfo();
    }, []);

    // 2. 当获取到队伍和 Socket 实例后，立即主动发送事件加入后端的队伍房间
    useEffect(() => {
        if (socket && (teamInfo?._id || user?.teamId)) {
            const currentTeamId = teamInfo?._id || user?.teamId;
            const currentStudentId = user?._id || user?.id;
            
            socket.emit('JOIN_TEAM_ROOM', { teamId: currentTeamId, studentId: currentStudentId });
        }
    }, [socket, teamInfo, user]);

    // 3. ✨【核心修复】完善 Socket 监听逻辑（加入全组就位和老师发卷的监听）
    useEffect(() => {
        if (!socket) return;

        // 监听1：如果后端判定全组就位（或有人拿到锁），通知进入
        const handleTeamReady = (data) => {
            if (isReady && data.testId) {
                setStatusMsg('系统已分配答题设备，正在进入考场...');
                setTimeout(() => navigate(`/student/test/${data.testId}`), 1000);
            }
        };

        // 监听2：如果学生早就 Ready 了，老师后来才点发布测试，自动拉进考场
        const handleTestStarted = (data) => {
            if (isReady && data.testId) {
                setStatusMsg('老师已发布测试，正在进入考场...');
                setTimeout(() => navigate(`/student/test/${data.testId}`), 1000);
            }
        };

        socket.on('TEAM_ALL_READY', handleTeamReady);
        socket.on('TEST_STARTED', handleTestStarted);

        return () => {
            socket.off('TEAM_ALL_READY', handleTeamReady);
            socket.off('TEST_STARTED', handleTestStarted);
        };
    }, [socket, isReady, navigate]);

    // 4. GPS就位校验与状态写入
    const handleReadyCheck = async () => {
        if (!teamInfo?._id) return;

        try {
            const pos = await getPosition();
            
            const res = await request.post('/student/ready', {
                teamId: teamInfo._id,
                lat: pos.lat,
                lng: pos.lng
            });

            if (res.success) {
                setIsReady(true);
                setStatusMsg(res.message || 'GPS校验通过，等待教师发卷...');
                
                // 如果后端告知测试已经在进行中，直接跳入
                if (res.testPublished && res.testId) {
                    setTimeout(() => navigate(`/student/test/${res.testId}`), 1000);
                }
            }
        } catch (err) {
            // 🚨 如果 GPS 校验失败（距离过远），保持 isReady 为 false，允许学生重试
            setIsReady(false); 
            // 提取后端传过来的 message，例如 "距离过远 (800米)..."
            const errorMsg = err.response?.data?.message || err.message || '定位失败，请重试';
            setStatusMsg(errorMsg);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>欢迎，{user.name}</h2>
                <button onClick={logout} style={{ padding: '5px 10px', color: 'white', background: '#dc3545', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>退出登录</button>
            </div>

            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0 }}>👥 我的队伍: {teamInfo?.teamName || '加载中...'}</h3>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                        {user.name} (你) - {user.upi}
                    </li>
                    {teamInfo?.members?.filter(m => m.upi !== user.upi).map(member => (
                        <li key={member.upi} style={{ marginBottom: '8px', color: '#555' }}>
                            {member.name} - {member.upi}
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ border: '2px dashed #ccc', padding: '30px', textAlign: 'center', borderRadius: '8px' }}>
                <h3 style={{ color: isReady ? 'green' : '#d9534f', minHeight: '30px' }}>
                    {statusMsg}
                </h3>
                {geoError && <p style={{ color: 'red', fontSize: '12px' }}>定位错误详情: {geoError}</p>}

                {/* ✨ 优化了按钮逻辑与文案：只要没 isReady，就允许学生无限重试 */}
                <button 
                    onClick={handleReadyCheck} 
                    disabled={isLocating || isReady}
                    style={{ 
                        marginTop: '20px', padding: '12px 30px', fontSize: '16px', 
                        background: isReady ? '#28a745' : '#007bff', 
                        color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' 
                    }}
                >
                    {isLocating ? '定位中...' : (isReady ? '✅ 准备就绪，等待开考' : (statusMsg.includes('过远') ? '📍 距离过远，点击重试' : '📍 开始准备 (获取GPS)'))}
                </button>
            </div>
        </div>
    );
}