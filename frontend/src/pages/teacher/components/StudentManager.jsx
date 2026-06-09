import React, { useEffect, useState } from 'react';
import request from '../../../api/request';

export default function StudentManager() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [students, setStudents] = useState([]);
    const [sendingEmails, setSendingEmails] = useState(false);
    const [clearingStudents, setClearingStudents] = useState(false);

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

    const handleSendPasswordEmails = async () => {
        if (!window.confirm('Send login password emails to all imported students?')) return;

        setSendingEmails(true);
        setMessage('');
        try {
            const res = await request.post('/teams/send-password-emails', null, { timeout: 180000 });
            setMessage(res.message || 'Password emails sent.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSendingEmails(false);
        }
    };

    const handleClearStudents = async () => {
        if (!window.confirm('Clear all imported students? This cannot be undone.')) return;

        setClearingStudents(true);
        setMessage('');
        try {
            const res = await request.delete('/teams/students');
            setStudents([]);
            setMessage(res.message || 'Student roster cleared.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setClearingStudents(false);
        }
    };

    const isBusy = loading || sendingEmails || clearingStudents;

    return (
        <section className="card stack student-roster-panel">
            <div className="student-roster-header">
                <div>
                    <h2>Students</h2>
                    <p className="subtitle">Imported students and login credentials.</p>
                </div>
                <div className="roster-counts" aria-label="Roster summary">
                    <span className="badge">{students.length} Students</span>
                </div>
            </div>

            <div className="roster-actions">
                <input
                    id="student-roster-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImport}
                    disabled={isBusy}
                    style={{ display: 'none' }}
                />
                <label className={`btn ${isBusy ? 'disabled-label' : ''}`} htmlFor="student-roster-upload">Import File</label>
                <button className="btn" type="button" onClick={handleSendPasswordEmails} disabled={isBusy || students.length === 0}>
                    {sendingEmails ? 'Sending Emails...' : 'Send Emails'}
                </button>
                <button className="btn danger" type="button" onClick={handleClearStudents} disabled={isBusy || students.length === 0}>
                    {clearingStudents ? 'Clearing...' : 'Delete'}
                </button>
            </div>

            <div className="import-guide">
                <div>
                    <h3>Import Format</h3>
                    <p>Upload an Excel or CSV roster with one row per student.</p>
                </div>
                <div className="format-table-shell">
                    <table className="format-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>UPI</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Student full name</td>
                                <td>Student UPI</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="muted">The uploaded roster fully replaces the current student list. Emails are generated as UPI@aucklanduni.ac.nz, and existing passwords are kept for unchanged UPIs.</p>
            </div>

            {message && <p className="status-text">{message}</p>}

            <div className="table-shell scroll-area">
                <table className="table roster-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>UPI</th>
                            <th>Email</th>
                            <th>Password</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student) => (
                            <tr key={student._id || student.upi}>
                                <td>{student.name}</td>
                                <td>{student.upi}</td>
                                <td>{student.email}</td>
                                <td>{student.password}</td>
                            </tr>
                        ))}
                        {students.length === 0 && (
                            <tr>
                                <td colSpan="4" className="empty-table-cell">
                                    <div className="empty-state">
                                        <strong>No students imported.</strong>
                                        <span>Import a roster to create student login credentials.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
