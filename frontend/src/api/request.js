import axios from 'axios';

const request = axios.create({
    baseURL: 'http://localhost:5000/api',
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
            if (error.response.status === 401) {
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
