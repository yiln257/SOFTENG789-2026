import axios from 'axios';

// 创建 axios 实例
const request = axios.create({
    baseURL: 'http://localhost:5000/api', // 指向后端 Docker 暴露的端口
    timeout: 10000, // 超时时间 10 秒
});

// 请求拦截器：自动注入 Token
request.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器：统一处理错误和 401 登出
request.interceptors.response.use(
    (response) => {
        // 直接返回后端的标准数据结构 { success, data/message }
        return response.data;
    },
    (error) => {
        if (error.response) {
            // 如果后端返回 401 未授权，强制清理本地数据并退回登录页
            if (error.response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login'; // 强制跳转
            }
            return Promise.reject(new Error(error.response.data.message || '服务器请求错误'));
        } else if (error.request) {
            return Promise.reject(new Error('网络连接失败，请检查后端服务是否启动'));
        } else {
            return Promise.reject(error);
        }
    }
);

export default request;