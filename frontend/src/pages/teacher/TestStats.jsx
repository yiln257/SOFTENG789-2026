import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import request from '../../api/request';

export default function TestStats() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await request.get(`/tests/${testId}/statistics`);
                if (res.success) setStats(res.statistics);
            } catch (err) {
                console.error('获取统计失败', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [testId]);

    // 处理 CSV 导出 (绕过 request.js 的默认拦截，因为我们需要接收二进制流)
    const handleExportCSV = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios({
                url: `http://localhost:5000/api/tests/${testId}/export`,
                method: 'GET',
                responseType: 'blob', // 关键：表明接收二进制数据
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // 触发浏览器下载
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `test_results_${testId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('导出失败，请检查网络或后端接口');
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>数据加载中...</div>;

    return (
        <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => navigate('/teacher/dashboard')} style={{ marginBottom: '20px' }}>
                ⬅️ 返回大厅
            </button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>📊 测试数据统计盘 (试卷ID: {testId})</h2>
                <button onClick={handleExportCSV} style={{ background: '#28a745', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    📥 导出详细 CSV
                </button>
            </div>

            {stats ? (
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginTop: '20px' }}>
                    {/* 这里根据你后端实际返回的 statistics 结构来渲染，这里做个简单示例 */}
                    <p>你可以直接把后端返回的 JSON 数据结构平铺在这里：</p>
                    <pre style={{ background: '#eee', padding: '15px', borderRadius: '4px', overflowX: 'auto' }}>
                        {JSON.stringify(stats, null, 2)}
                    </pre>
                </div>
            ) : (
                <p>暂无统计数据</p>
            )}
        </div>
    );
}