const express = require('express');
const { getConnection, sql } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// 获取所有请假记录
router.get('/', authenticate, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT l.*, t.name AS teacher_name, d.dept_name
            FROM Leaves l
            LEFT JOIN Teachers t ON l.teacher_id = t.teacher_id
            LEFT JOIN Departments d ON t.dept_id = d.dept_id
            ORDER BY l.created_at DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取请假记录失败' });
    }
});

// 获取教师个人请假记录
router.get('/teacher/:teacher_id', authenticate, async (req, res) => {
    try {
        const { teacher_id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('teacher_id', sql.Char(4), teacher_id)
            .query(`
                SELECT l.*, t.name AS teacher_name
                FROM Leaves l
                LEFT JOIN Teachers t ON l.teacher_id = t.teacher_id
                WHERE l.teacher_id = @teacher_id
                ORDER BY l.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取教师请假记录失败' });
    }
});

// 提交请假申请
router.post('/', authenticate, async (req, res) => {
    try {
        const { leave_id, teacher_id, leave_type, start_date, end_date, reason } = req.body;
        
        if (!leave_id || !teacher_id || !leave_type || !start_date || !end_date || !reason) {
            return res.status(400).json({ error: '所有必填字段不能为空' });
        }

        const pool = await getConnection();
        
        // 检查请假编号是否已存在
        const existCheck = await pool.request()
            .input('id', sql.Char(4), leave_id)
            .query('SELECT leave_id FROM Leaves WHERE leave_id = @id');
        if (existCheck.recordset.length > 0) {
            return res.status(400).json({ error: '请假编号已存在' });
        }

        await pool.request()
            .input('leave_id', sql.Char(4), leave_id)
            .input('teacher_id', sql.Char(4), teacher_id)
            .input('leave_type', sql.NVarChar(20), leave_type)
            .input('start_date', sql.Date, start_date)
            .input('end_date', sql.Date, end_date)
            .input('reason', sql.NVarChar(200), reason)
            .input('status', sql.NVarChar(10), '待审核')
            .query(`
                INSERT INTO Leaves (leave_id, teacher_id, leave_type, start_date, end_date, reason, status)
                VALUES (@leave_id, @teacher_id, @leave_type, @start_date, @end_date, @reason, @status)
            `);

        res.status(201).json({ message: '请假申请提交成功', leave_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '提交请假申请失败' });
    }
});

// 审核请假（通过/驳回）
router.put('/:leave_id/approve', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { leave_id } = req.params;
        const { status, approver } = req.body;
        
        if (!status || !['已通过', '已驳回'].includes(status)) {
            return res.status(400).json({ error: '审批状态必须为"已通过"或"已驳回"' });
        }

        const pool = await getConnection();
        
        // 检查请假是否存在
        const existCheck = await pool.request()
            .input('leave_id', sql.Char(4), leave_id)
            .query('SELECT leave_id, status FROM Leaves WHERE leave_id = @leave_id');
        if (existCheck.recordset.length === 0) {
            return res.status(404).json({ error: '请假记录不存在' });
        }
        if (existCheck.recordset[0].status !== '待审核') {
            return res.status(400).json({ error: '该请假已审核，不能重复操作' });
        }

        await pool.request()
            .input('leave_id', sql.Char(4), leave_id)
            .input('status', sql.NVarChar(10), status)
            .input('approver', sql.NVarChar(20), approver || '系统管理员')
            .input('approve_time', sql.DateTime, new Date())
            .query(`
                UPDATE Leaves SET
                    status = @status,
                    approver = @approver,
                    approve_time = @approve_time
                WHERE leave_id = @leave_id
            `);

        // 触发器会自动更新考勤状态
        res.json({ message: '请假审核完成', leave_id, status });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '审核请假失败' });
    }
});

// 删除请假记录
router.delete('/:leave_id', authenticate, requireRole('超级管理员'), async (req, res) => {
    try {
        const { leave_id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('leave_id', sql.Char(4), leave_id)
            .query('DELETE FROM Leaves WHERE leave_id = @leave_id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: '请假记录不存在' });
        }
        res.json({ message: '请假记录删除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除请假记录失败' });
    }
});

module.exports = router;