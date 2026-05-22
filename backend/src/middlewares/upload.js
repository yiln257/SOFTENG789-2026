// 文件路径：backend/src/middlewares/upload.js
import multer from 'multer';

// 使用内存存储（MemoryStorage）
// 文件不会存入硬盘，而是直接变成 Buffer 放在 req.file.buffer 中，非常适合接下来用 xlsx 直接解析
const storage = multer.memoryStorage();

// 导出一个 upload 中间件，并限制文件最大为 5MB
export const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});