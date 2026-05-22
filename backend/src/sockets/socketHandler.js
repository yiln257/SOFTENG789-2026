export const setupSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on('join_user', ({ studentId }) => {
            if (!studentId) return;
            socket.join(`user_${studentId}`);
        });

        const joinTeamRoom = ({ teamId, studentId }) => {
            if (!teamId) return;
            socket.join(`team_${teamId}`);
            console.log(`Student ${studentId || 'unknown'} joined team_${teamId}`);
        };

        socket.on('join_team', joinTeamRoom);
        socket.on('JOIN_TEAM_ROOM', joinTeamRoom);

        socket.on('teacher_join', () => {
            socket.join('teacher_room');
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
};
