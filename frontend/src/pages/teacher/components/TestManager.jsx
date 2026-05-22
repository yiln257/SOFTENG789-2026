import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import request from '../../../api/request';

const statusLabel = {
    draft: 'Draft',
    published: 'Live',
    closed: 'Closed'
};

export default function TestManager() {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const fetchTests = async () => {
        try {
            const res = await request.get('/tests');
            if (res.success) setTests(res.tests || []);
        } catch (error) {
            setMessage(error.message);
        }
    };

    useEffect(() => {
        fetchTests();
    }, []);

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setMessage('');
        try {
            const res = await request.post('/tests/import', formData);
            setMessage(res.message || 'Test imported successfully.');
            await fetchTests();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
            event.target.value = '';
        }
    };

    const handlePublish = async (testId) => {
        if (!window.confirm('Publish this test now?')) return;
        try {
            await request.post(`/tests/${testId}/publish`);
            navigate(`/teacher/live/${testId}`);
        } catch (error) {
            window.alert(error.message);
        }
    };

    const handleDeleteRecord = async (testId, status) => {
        const label = status === 'draft' ? 'unpublished draft test' : 'closed test record';
        if (!window.confirm(`Delete this ${label}?`)) return;
        try {
            const res = await request.delete(`/tests/${testId}`);
            setMessage(res.message || 'Test record deleted.');
            await fetchTests();
        } catch (error) {
            window.alert(error.message);
        }
    };

    const handleDeleteResults = async (testId) => {
        if (!window.confirm('Delete all result records for this test?')) return;
        try {
            const res = await request.delete(`/tests/${testId}/results`);
            setMessage(res.message || 'Results deleted.');
            await fetchTests();
        } catch (error) {
            window.alert(error.message);
        }
    };

    return (
        <section className="card stack">
            <div className="row wrap">
                <div>
                    <h2>Tests</h2>
                    <p className="subtitle">Import, publish, control, and review tests.</p>
                </div>
                <div className="spacer" />
                <input className="field" style={{ maxWidth: 320 }} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} disabled={loading} />
            </div>

            {message && <p className="status-text">{message}</p>}

            <table className="table">
                <thead>
                    <tr>
                        <th>Test ID</th>
                        <th>Status</th>
                        <th>Questions</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map((test) => (
                        <tr key={test._id}>
                            <td>{test._id}</td>
                            <td><span className="badge">{statusLabel[test.status] || test.status}</span></td>
                            <td>{test.questionCount || 0}</td>
                            <td>{new Date(test.createdAt).toLocaleString()}</td>
                            <td>
                                <div className="row wrap">
                                    {test.status === 'draft' && (
                                        <>
                                            <button className="btn" onClick={() => handlePublish(test._id)}>Publish</button>
                                            <button className="btn danger" onClick={() => handleDeleteRecord(test._id, test.status)}>Delete Draft</button>
                                        </>
                                    )}
                                    {test.status === 'published' && (
                                        <button className="btn" onClick={() => navigate(`/teacher/live/${test._id}`)}>Control</button>
                                    )}
                                    {test.status === 'closed' && (
                                        <>
                                            <button className="btn secondary" onClick={() => navigate(`/teacher/stats/${test._id}`)}>View Results</button>
                                            <button className="btn warning" onClick={() => handleDeleteResults(test._id)}>Delete Results</button>
                                            <button className="btn danger" onClick={() => handleDeleteRecord(test._id, test.status)}>Delete Record</button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {tests.length === 0 && (
                        <tr>
                            <td colSpan="5" className="muted">No tests yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
    );
}
