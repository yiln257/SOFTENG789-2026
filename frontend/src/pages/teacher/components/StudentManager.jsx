import React, { useState } from 'react';
import request from '../../../api/request';

export default function StudentManager() {
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0); // 邮件防刷倒计时

    // 1. 导入名单
    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        setLoading(true);
        try {
            const res = await request.post('/teams/import', formData);
            alert(res.message || '学生名单导入成功');
        } catch (err) {
            alert('导入失败: ' + err.message);
        } finally {
            setLoading(false);
            e.target.value = ''; // 清空 file input，允许重复上传同名文件
        }
    };

    // 2. 随机分组
    const handleRandomGroup = async () => {
        setLoading(true);
        try {
            const res = await request.post('/teams/random-group');
            alert(res.message || '随机分组完成');
        } catch (err) {
            alert('分组失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // 3. 发送邮件
    const handleSendEmails = async () => {
        if (cooldown > 0) return alert('发送任务冷却中，请勿频繁点击');
        setLoading(true);
        try {
            const res = await request.post('/teams/send-emails');
            alert(res.message || '邮件发送任务已启动，将在1小时内平滑发出');
            setCooldown(3600); // 简单前端倒计时，实际工程可存入 Redis/LocalStorage
            
            // 启动定时器递减
            const timer = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) clearInterval(timer);
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            alert('发送失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>👥 学生名单与分组管理</h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div>
                    <label>1. 导入名单 (Excel): </label>
                    <input type="file" accept=".xlsx, .xls" onChange={handleImport} disabled={loading} />
                </div>
                <button onClick={handleRandomGroup} disabled={loading}>2. 随机分组</button>
                <button onClick={handleSendEmails} disabled={loading || cooldown > 0}>
                    3. 发送分组邮件 {cooldown > 0 && `(${cooldown}s)`}
                </button>
            </div>
        </div>
    );
}