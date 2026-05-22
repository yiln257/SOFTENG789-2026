import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = 'http://localhost:5000';

export const useSocket = () => {
    const socketRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        // 如果没有用户信息，不建立连接
        if (!user) return;

        // 初始化连接
        socketRef.current = io(SOCKET_URL, {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('🟢 Socket已连接:', socket.id);
            
            // 根据身份发送加入指令
            if (user.role === 'teacher') {
                socket.emit('teacher_join');
            } else if (user.role === 'student') {
                socket.emit('join_team', { 
                    teamId: user.teamId, 
                    studentId: user._id || user.upi 
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('🔴 Socket已断开');
        });

        // 组件卸载时断开连接，防止内存泄漏
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user]);

    // 返回 socket 实例，供页面监听 test_published, question_changed 等事件
    return socketRef.current;
};