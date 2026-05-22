import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import TeacherDashboard from './pages/teacher/Dashboard';
import StudentDashboard from './pages/student/Dashboard';
import TeacherLiveControl from './pages/teacher/LiveControl';
import StudentLiveTest from './pages/student/LiveTest';
import StudentFeedback from './pages/student/Feedback';
import TestStats from './pages/teacher/TestStats';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/live/:testId" element={<ProtectedRoute allowedRole="teacher"><TeacherLiveControl /></ProtectedRoute>} />
            <Route path="/teacher/stats/:testId" element={<ProtectedRoute allowedRole="teacher"><TestStats /></ProtectedRoute>} />

            <Route path="/student/dashboard" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/test/:testId" element={<ProtectedRoute allowedRole="student"><StudentLiveTest /></ProtectedRoute>} />
            <Route path="/student/feedback/:testId" element={<ProtectedRoute allowedRole="student"><StudentFeedback /></ProtectedRoute>} />

            <Route path="*" element={<div className="app-shell">404 - Page not found</div>} />
        </Routes>
    );
}
