import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import request from '../../api/request';
import StudentManager from './components/StudentManager';
import TestManager from './components/TestManager';

export default function TeacherDashboard() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('students');
    const [gpsStatus, setGpsStatus] = useState('未更新');

    // 获取并上传教师当前位置作为时空锚点
    const updateGPS = () => {
        if (!navigator.geolocation) {
            return alert('您的浏览器不支持或已禁用地理位置服务');
        }
        
        setGpsStatus('定位获取中...');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await request.post('/teacher/gps', {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                    setGpsStatus(`已更新 (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
                    alert('考场GPS基准点设定成功！学生必须在500米范围内签到。');
                } catch (error) {
                    setGpsStatus('更新失败');
                    alert(error.message);
                }
            }, 
            (err) => {
                setGpsStatus('未更新');
                alert('获取定位失败，请确保浏览器允许定位权限: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2>👨‍🏫 教师综合控制台</h2>
                <div>
                    <span style={{ marginRight: '15px' }}>欢迎, {user?.email} </span>
                    <button onClick={logout}>退出系统</button>
                </div>
            </header>

            {/* 考场 GPS 定位围栏 */}
            <div style={{ background: '#f8f9fa', padding: '15px', marginBottom: '25px', borderRadius: '8px', borderLeft: '4px solid #007bff' }}>
                <strong>📍 考场空间基准点: </strong>
                <span style={{ margin: '0 15px', color: gpsStatus.includes('已更新') ? 'green' : 'red' }}>
                    {gpsStatus}
                </span>
                <button onClick={updateGPS}>重新获取并设定位置</button>
            </div>

            {/* 功能 Tab 切换 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={() => setActiveTab('students')} 
                    style={{ padding: '10px 20px', background: activeTab === 'students' ? '#007bff' : '#eee', color: activeTab === 'students' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    👥 名单与分组管理
                </button>
                <button 
                    onClick={() => setActiveTab('tests')} 
                    style={{ padding: '10px 20px', background: activeTab === 'tests' ? '#007bff' : '#eee', color: activeTab === 'tests' ? '#fff' : '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    📝 试卷与发卷管理
                </button>
            </div>

            {/* 动态渲染子模块 */}
            {activeTab === 'students' && <StudentManager />}
            {activeTab === 'tests' && <TestManager />}
        </div>
    );
}