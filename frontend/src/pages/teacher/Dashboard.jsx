import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import request from '../../api/request';
import StudentManager from './components/StudentManager';
import TestManager from './components/TestManager';

const formatCountdown = (seconds) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
};

export default function TeacherDashboard() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('students');
    const [gpsStatus, setGpsStatus] = useState('loading');
    const [teacherGps, setTeacherGps] = useState(null);
    const [now, setNow] = useState(Date.now());

    const loadGpsStatus = async () => {
        try {
            const res = await request.get('/teacher/gps');
            if (res.success) {
                setTeacherGps(res.teacherGps);
                setGpsStatus('idle');
            }
        } catch (error) {
            setGpsStatus('error');
        }
    };

    useEffect(() => {
        loadGpsStatus();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const gpsRemainingSeconds = useMemo(() => {
        if (!teacherGps?.expiresAt) return null;

        const expiresAt = new Date(teacherGps.expiresAt).getTime();
        if (!Number.isFinite(expiresAt)) return null;

        return Math.max(0, Math.ceil((expiresAt - now) / 1000));
    }, [teacherGps?.expiresAt, now]);

    const isGpsActive = Boolean(teacherGps?.status === 'ready' && gpsRemainingSeconds > 0);
    const gpsCountdown = isGpsActive ? `Expires in ${formatCountdown(gpsRemainingSeconds)}` : null;

    const gpsPanel = useMemo(() => {
        if (isGpsActive) {
            return {
                badge: <span className="badge success">Active</span>,
                message: 'Students can check in now.',
                detail: gpsCountdown
            };
        }

        const message = gpsStatus === 'locating'
            ? 'Getting current classroom GPS position.'
            : gpsStatus === 'error'
                ? 'Unable to update classroom GPS. Please try again.'
                : 'Set classroom GPS before students check in.';

        return {
            badge: <span className="badge">Not set</span>,
            message,
            detail: null
        };
    }, [gpsCountdown, gpsStatus, isGpsActive]);

    const updateGPS = () => {
        if (!navigator.geolocation) {
            window.alert('This browser does not support geolocation.');
            return;
        }

        setGpsStatus('locating');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    await request.post('/teacher/gps', {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                    await loadGpsStatus();
                } catch (error) {
                    setGpsStatus('error');
                    window.alert(error.message);
                }
            },
            (error) => {
                setGpsStatus('idle');
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
                    <div className="row">
                        <h2 style={{ margin: 0 }}>Classroom GPS</h2>
                        {gpsPanel.badge}
                    </div>
                    <p className="muted">{gpsPanel.message}</p>
                    {gpsPanel.detail && <p className="muted">{gpsPanel.detail}</p>}
                </div>
                <div className="spacer" />
                <button className="btn" onClick={updateGPS} disabled={gpsStatus === 'locating'}>
                    {gpsStatus === 'locating' ? 'Setting...' : isGpsActive ? 'Refresh GPS' : 'Set GPS'}
                </button>
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
