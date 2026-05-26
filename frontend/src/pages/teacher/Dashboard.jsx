import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import request from '../../api/request';
import StudentManager from './components/StudentManager';
import TestManager from './components/TestManager';

export default function TeacherDashboard() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('students');
    const [gpsStatus, setGpsStatus] = useState('Not set');

    const updateGPS = () => {
        if (!navigator.geolocation) {
            window.alert('This browser does not support geolocation.');
            return;
        }

        setGpsStatus('Getting location...');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await request.post('/teacher/gps', {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                    setGpsStatus(`Set at ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                } catch (error) {
                    setGpsStatus('Update failed');
                    window.alert(error.message);
                }
            },
            (error) => {
                setGpsStatus('Not set');
                window.alert(`Location failed: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <main className="app-shell">
            <header className="topbar">
                <div>
                    <h1>Teacher Dashboard</h1>
                    <p className="subtitle">{user?.email}</p>
                </div>
                <button className="btn ghost" onClick={logout}>Sign Out</button>
            </header>

            <section className="card row wrap" style={{ marginBottom: 18 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Classroom GPS</h2>
                    <p className="subtitle">{gpsStatus}</p>
                </div>
                <div className="spacer" />
                <button className="btn" onClick={updateGPS}>Set GPS</button>
            </section>

            <nav className="segmented" style={{ marginBottom: 18 }}>
                <button
                    type="button"
                    className={activeTab === 'students' ? 'active' : ''}
                    onClick={() => setActiveTab('students')}
                >
                    Students
                </button>
                <button
                    type="button"
                    className={activeTab === 'tests' ? 'active' : ''}
                    onClick={() => setActiveTab('tests')}
                >
                    Tests
                </button>
            </nav>

            {activeTab === 'students' && <StudentManager />}
            {activeTab === 'tests' && <TestManager />}
        </main>
    );
}
