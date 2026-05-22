import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import request from '../../../api/request';

export default function TestManager() {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // 拉取试卷列表
    const fetchTests = async () => {
        try {
            const res = await request.get('/tests');
            if(res.success) setTests(res.tests || []);
        } catch (err) {
            console.error('拉取试卷失败', err);
        }
    };

    // 组件挂载时拉取一次数据
    useEffect(() => {
        fetchTests();
    }, []);

    // 导入试卷
    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        setLoading(true);
        try {
            await request.post('/tests/import', formData);
            alert('试卷导入成功');
            fetchTests(); // 重新拉取列表
        } catch (err) {
            alert('导入失败: ' + err.message);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    // 发布试卷 (直播发卷)
    const handlePublish = async (testId) => {
        if(!window.confirm('确认发布该测试吗？发布后学生端将收到提醒并可进入考场。')) return;
        try {
            await request.post(`/tests/${testId}/publish`);
            // 跳转到教师端的“直播控制台”
            navigate(`/teacher/live/${testId}`);
        } catch (err) {
            alert('发布失败: ' + err.message);
        }
    };

    return (
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>📝 试卷与发卷管理</h3>
            <div style={{ marginBottom: '20px' }}>
                <label>导入试卷 (必须包含 correctAnswer 列): </label>
                <input type="file" accept=".xlsx, .xls" onChange={handleImport} disabled={loading} />
            </div>

            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #ccc' }}>
                        <th style={{ padding: '8px' }}>试卷ID</th>
                        <th>状态</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map(test => (
                        <tr key={test._id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{test._id}</td>
                            <td>{test.status === 'draft' ? '草稿' : test.status === 'published' ? '考试中' : '已结束'}</td>
                            <td>{new Date(test.createdAt).toLocaleString()}</td>
                            <td>
                                {test.status === 'draft' && (
                                    <button onClick={() => handlePublish(test._id)}>发布测试</button>
                                )}
                                {test.status === 'published' && (
                                    <button onClick={() => navigate(`/teacher/live/${test._id}`)}>重连控制台</button>
                                )}
                                {/* 👇 “已结束”状态的按钮 👇 */}
                                {test.status === 'closed' && (
                                    <button 
                                        onClick={() => navigate(`/teacher/stats/${test._id}`)}
                                        style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}
                                    >
                                        查看统计 / 导出
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {tests.length === 0 && <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center' }}>暂无试卷记录</td></tr>}
                </tbody>
            </table>
        </div>
    );
}