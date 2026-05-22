import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import request from '../api/request';

export default function Login() {
    const [role, setRole] = useState('student'); // 默认学生登录
    const [account, setAccount] = useState(''); // 教师填邮箱，学生填 UPI
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            let res;
            if (role === 'teacher') {
                // 教师登录调用
                res = await request.post('/auth/teacher/login', { 
                    email: account, 
                    password 
                });
            } else {
                // 学生登录调用
                res = await request.post('/auth/student/login', { 
                    upi: account, 
                    password 
                });
            }

            if (res.success) {
                // 将 Token 和用户信息写入全局 Context 和 LocalStorage
                // 注意：为了统一，我们在 user 对象中补上 role 标识
                const userData = { ...res.user, role }; 
                login(res.token, userData);

                // 跳转到对应的主控台
                navigate(`/${role}/dashboard`);
            }
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 极简 UI，方便测试 (后续你可自行套用 Tailwind)
    const containerStyle = { maxWidth: '400px', margin: '100px auto', padding: '30px', border: '1px solid #ccc', borderRadius: '8px' };
    const inputStyle = { width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' };
    const btnStyle = { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' };

    return (
        <div style={containerStyle}>
            <h2 style={{ textAlign: 'center' }}>答题系统登录</h2>
            
            <div style={{ display: 'flex', marginBottom: '20px' }}>
                <button 
                    style={{ flex: 1, padding: '10px', background: role === 'student' ? '#eee' : '#fff' }}
                    onClick={() => { setRole('student'); setAccount(''); setErrorMsg(''); }}
                >
                    👨‍🎓 学生入口
                </button>
                <button 
                    style={{ flex: 1, padding: '10px', background: role === 'teacher' ? '#eee' : '#fff' }}
                    onClick={() => { setRole('teacher'); setAccount('yi.lin.uoa@outlook.co.nz'); setErrorMsg(''); }}
                >
                    👨‍🏫 教师入口
                </button>
            </div>

            <form onSubmit={handleLogin}>
                <input 
                    style={inputStyle}
                    type={role === 'teacher' ? 'email' : 'text'} 
                    placeholder={role === 'teacher' ? "教师邮箱" : "学生 UPI"} 
                    value={account} 
                    onChange={e => setAccount(e.target.value)} 
                    required 
                />
                <input 
                    style={inputStyle}
                    type="password" 
                    placeholder="登录密码" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                />
                
                {errorMsg && <div style={{ color: 'red', marginBottom: '15px' }}>❌ {errorMsg}</div>}
                
                <button type="submit" style={btnStyle} disabled={isLoading}>
                    {isLoading ? '登录中...' : '登录'}
                </button>
            </form>
        </div>
    );
}