import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './src/config/db.js'; // 注意：必须加 .js 后缀
import { connectRedis } from './src/config/redis.js'; 

// 这里可以开始引入你的 Models 进行测试
// import User from './src/models/User.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;

connectDB();
connectRedis();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend is running with ESM, MongoDB, and Redis.' });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});