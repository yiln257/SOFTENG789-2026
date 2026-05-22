import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import request from '../api/request';

export default function Login() {
    const [role, setRole] = useState('student');
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (event) => {
        event.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            const res = role === 'teacher'
                ? await request.post('/auth/teacher/login', { email: account, password })
                : await request.post('/auth/student/login', { upi: account, password });

            if (res.success) {
                login(res.token, { ...res.user, role });
                navigate(`/${role}/dashboard`);
            }
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-card">
            <section className="card stack">
                <div>
                    <h1 style={{ margin: 0 }}>Live Test System</h1>
                    <p className="subtitle">Sign in with your role account.</p>
                </div>

                <div className="segmented" aria-label="Role">
                    <button
                        type="button"
                        className={role === 'student' ? 'active' : ''}
                        onClick={() => {
                            setRole('student');
                            setAccount('');
                            setErrorMsg('');
                        }}
                    >
                        Student
                    </button>
                    <button
                        type="button"
                        className={role === 'teacher' ? 'active' : ''}
                        onClick={() => {
                            setRole('teacher');
                            setAccount('jesin.james@auckland.ac.nz');
                            setErrorMsg('');
                        }}
                    >
                        Teacher
                    </button>
                </div>

                <form className="stack" onSubmit={handleLogin}>
                    <input
                        className="field"
                        type={role === 'teacher' ? 'email' : 'text'}
                        placeholder={role === 'teacher' ? 'Teacher email' : 'Student UPI'}
                        value={account}
                        onChange={(event) => setAccount(event.target.value)}
                        required
                    />
                    <input
                        className="field"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />

                    {errorMsg && <div className="error">{errorMsg}</div>}

                    <button type="submit" className="btn" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </section>
        </main>
    );
}
