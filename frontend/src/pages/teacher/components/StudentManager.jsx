import React, { useEffect, useState } from 'react';
import request from '../../../api/request';

export default function StudentManager() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedFileName, setSelectedFileName] = useState('No file selected');

    const fetchStudents = async () => {
        try {
            const res = await request.get('/teams/students');
            if (res.success) setStudents(res.students || []);
        } catch (error) {
            setMessage(error.message);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setSelectedFileName(file.name);

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setMessage('');
        try {
            const res = await request.post('/teams/import', formData);
            setMessage(res.message || 'Roster imported successfully.');
            await fetchStudents();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
            event.target.value = '';
        }
    };

    const handlePrintPasswords = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await request.post('/teams/print-passwords');
            setMessage(res.message || 'Passwords printed to the backend console.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="card stack">
            <div>
                <h2>Student Roster</h2>
                <p className="subtitle">Uploading a roster replaces the current student list. Passwords are generated once and stay unchanged.</p>
            </div>

            <div className="row wrap">
                <input
                    id="student-roster-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImport}
                    disabled={loading}
                    style={{ display: 'none' }}
                />
                <label className="btn" htmlFor="student-roster-upload">Import Student Roster</label>
                <span className="muted">{selectedFileName}</span>
                <button className="btn secondary" type="button" onClick={handlePrintPasswords} disabled={loading}>
                    Print Login Passwords
                </button>
            </div>

            {message && <p className="status-text">{message}</p>}

            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>UPI</th>
                        <th>Password</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student) => (
                        <tr key={student._id || student.upi}>
                            <td>{student.name}</td>
                            <td>{student.upi}</td>
                            <td>{student.password}</td>
                        </tr>
                    ))}
                    {students.length === 0 && (
                        <tr>
                            <td colSpan="3" className="muted">No students imported.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
    );
}
