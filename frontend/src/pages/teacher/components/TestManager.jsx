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

    return (
        <section className="card stack student-roster-panel">
            <div className="student-roster-header">
                <div>
                    <h2>Tests</h2>
                    <p className="subtitle">Import, publish, control, and review tests.</p>
                </div>
                <div className="roster-counts" aria-label="Tests summary">
                    <span className="badge">{tests.length} Tests</span>
                </div>
            </div>

            <div className="roster-actions">
                <input
                    id="test-file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImport}
                    disabled={loading}
                    style={{ display: 'none' }}
                />
                <label className={`btn ${loading ? 'disabled-label' : ''}`} htmlFor="test-file-upload">Import File</label>
            </div>

            <div className="import-guide">
                <div>
                    <h3>Import Format</h3>
                    <p>Upload an Excel or CSV file with one row per question.</p>
                </div>
                <div className="format-table-shell">
                    <table className="format-table test-format-table">
                        <thead>
                            <tr>
                                <th>Seq</th>
                                <th>OptionA</th>
                                <th>OptionB</th>
                                <th>OptionC</th>
                                <th>OptionD</th>
                                <th>CorrectAnswer</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Question number</td>
                                <td>Answer 1</td>
                                <td>Answer 2</td>
                                <td>Answer 3</td>
                                <td>Answer 4</td>
                                <td>A, B, C or D</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="muted">The test name comes from the file name.</p>
            </div>

            {message && <p className="status-text">{message}</p>}

            <div className="table-shell scroll-area">
                <table className="table roster-table test-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Questions</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tests.map((test) => (
                            <tr key={test._id}>
                                <td>{test.name || 'Untitled Test'}</td>
                                <td><span className="badge">{statusLabel[test.status] || test.status}</span></td>
                                <td>{test.questionCount || 0}</td>
                                <td>{new Date(test.createdAt).toLocaleString()}</td>
                                <td>
                                    <div className="row wrap table-actions">
                                        {test.status === 'draft' && (
                                            <>
                                                <button className="btn" onClick={() => handlePublish(test._id)}>Publish</button>
                                                <button className="btn danger" onClick={() => handleDeleteRecord(test._id, test.status)}>Delete</button>
                                            </>
                                        )}
                                        {test.status === 'published' && (
                                            <button className="btn" onClick={() => navigate(`/teacher/live/${test._id}`)}>Control</button>
                                        )}
                                        {test.status === 'closed' && (
                                            <>
                                                <button className="btn" onClick={() => navigate(`/teacher/stats/${test._id}`)}>View Results</button>
                                                <button className="btn danger" onClick={() => handleDeleteRecord(test._id, test.status)}>Delete</button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {tests.length === 0 && (
                            <tr>
                                <td colSpan="5" className="empty-table-cell">
                                    <div className="empty-state">
                                        <strong>No tests yet.</strong>
                                        <span>Import a test file to create your first test.</span>
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
