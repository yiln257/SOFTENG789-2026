export const setupSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // 学生登录后，前端需要主动发送 join_team 事件加入房间
        socket.on('join_team', ({ teamId, studentId }) => {
            if (teamId) {
                socket.join(`team_${teamId}`);
                console.log(`Student ${studentId} joined room: team_${teamId}`);
            }
        });

        // 教师端登录后加入全局教师房间 (用于接收特殊提醒，可选)
        socket.on('teacher_join', () => {
            socket.join('teacher_room');
            console.log('Teacher joined teacher_room');
        });

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });
};