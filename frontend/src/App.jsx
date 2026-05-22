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
            {/* 默认根路径重定向到登录页 */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* 公共路由 */}
            <Route path="/login" element={<Login />} />

            {/* 教师端私有路由 */}
            <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/live/:testId" element={<ProtectedRoute allowedRole="teacher"><TeacherLiveControl /></ProtectedRoute>} />
            {/* 👇 教师端统计路由 */}
            <Route path="/teacher/stats/:testId" element={<ProtectedRoute allowedRole="teacher"><TestStats /></ProtectedRoute>} />
            
            {/* 学生端私有路由 */}
            <Route path="/student/dashboard" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/test/:testId" element={<ProtectedRoute allowedRole="student"><StudentLiveTest /></ProtectedRoute>} />
            {/* 👇 学生端反馈路由 */}
            <Route path="/student/feedback/:testId" element={<ProtectedRoute allowedRole="student"><StudentFeedback /></ProtectedRoute>} />
            
            {/* 404 页面 */}
            <Route path="*" element={<div style={{padding:'50px'}}>404 - 找不到页面</div>} />
        </Routes>
    );
}