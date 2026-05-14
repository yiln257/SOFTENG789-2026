import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import { connectRedis } from './src/config/redis.js';
import apiRoutes from './src/routes/index.js';
import { setupSocket } from './src/sockets/socketHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// 初始化 Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // 开发环境下允许所有跨域，生产环境请改成前端实际地址
        methods: ['GET', 'POST']
    }
});

// 全局挂载 io，方便在 Controller 中直接通过 req.app.get('io') 调用广播
app.set('io', io);

// 中间件
app.use(cors());
app.use(express.json()); // 解析 application/json
app.use(express.urlencoded({ extended: true }));

// 挂载路由
app.use('/api', apiRoutes);

// 初始化 Socket 逻辑
setupSocket(io);

const PORT = process.env.PORT || 5000;

// 启动服务 (先连数据库，再启动HTTP)
const startServer = async () => {
    try {
        await connectDB();
        await connectRedis(); // 假设你的 redis.js 里导出了连接方法
        
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();