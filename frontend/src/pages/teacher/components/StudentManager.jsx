import React, { useState } from 'react';
import request from '../../../api/request';

export default function StudentManager() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

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
                <p className="subtitle">Students create teams from the lobby. New students receive a generated password that does not change.</p>
            </div>

            <div className="row wrap">
                <input className="field" type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} disabled={loading} />
                <button className="btn secondary" type="button" onClick={handlePrintPasswords} disabled={loading}>
                    Print Login Passwords
                </button>
            </div>

            {message && <p className="status-text">{message}</p>}
        </section>
    );
}
