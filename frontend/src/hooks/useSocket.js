import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = 'http://localhost:5000';

export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return undefined;

        const nextSocket = io(SOCKET_URL, {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        nextSocket.on('connect', () => {
            if (user.role === 'teacher') {
                nextSocket.emit('teacher_join');
            }

            if (user.role === 'student') {
                const studentId = user.id || user._id;
                nextSocket.emit('join_user', { studentId });

                const teamId = user.team?._id || user.teamId;
                if (teamId) {
                    nextSocket.emit('join_team', { teamId, studentId });
                }
            }
        });

        setSocket(nextSocket);

        return () => {
            nextSocket.disconnect();
            setSocket(null);
        };
    }, [user]);

    return socket;
};
