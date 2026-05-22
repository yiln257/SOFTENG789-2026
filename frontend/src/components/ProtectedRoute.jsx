import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
    const { user, loading } = useAuth();

    // 如果状态还在初始化，显示 loading
    if (loading) {
        return <div style={{ padding: '50px', textAlign: 'center' }}>🔄 验证身份中...</div>;
    }

    // 未登录，重定向到登录页
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 角色不匹配，踢回对应角色的主页
    if (allowedRole && user.role !== allowedRole) {
        return <Navigate to={`/${user.role}/dashboard`} replace />;
    }

    // 校验通过，正常渲染子组件
    return children;
}