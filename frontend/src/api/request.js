import axios from 'axios';
import { API_BASE_URL } from '../config/endpoints';

const request = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000
});

request.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

request.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response) {
            const requestUrl = error.config?.url || '';
            const isAuthLoginRequest = requestUrl.includes('/auth/student/login') || requestUrl.includes('/auth/teacher/login');

            if (error.response.status === 401 && !isAuthLoginRequest) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
            return Promise.reject(new Error(error.response.data.message || 'Server request failed.'));
        }

        if (error.request) {
            return Promise.reject(new Error('Network request failed. Please check that the backend is running.'));
        }

        return Promise.reject(error);
    }
);

export default request;
