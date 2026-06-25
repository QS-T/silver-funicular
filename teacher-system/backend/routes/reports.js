const express = require('express');
const { getConnection, sql } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// 月度课时统计（调用存储过程）
router.get('/monthly/:year/:month', authenticate, async (req, res) => {
    try {
        const { year, month } = req.params;
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .execute('sp_CalculateMonthlyHours');
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取月度统计失败' });
    }
});

// 部门考勤报表
router.get('/department/:dept_id/:year/:month', authenticate, requireRole('超级管理员', '教务员', '校领导'), async (req, res) => {
    try {
        const { dept_id, year, month } = req.params;
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('dept_id', sql.Char(3), dept_id)
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .execute('sp_GenerateDepartmentReport');
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取部门报表失败' });
    }
});

// 教师个人月度汇总
router.get('/teacher/:teacher_id/:year/:month', authenticate, async (req, res) => {
    try {
        const { teacher_id, year, month } = req.params;
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('teacher_id', sql.Char(4), teacher_id)
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .execute('sp_TeacherMonthlySummary');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: '教师不存在或没有考勤数据' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取教师月度汇总失败' });
    }
});

// 全校考勤汇总（领导端）
router.get('/summary/:year/:month', authenticate, requireRole('超级管理员', '校领导'), async (req, res) => {
    try {
        const { year, month } = req.params;
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .query(`
                SELECT 
                    d.dept_name,
                    COUNT(DISTINCT t.teacher_id) AS teacher_count,
                    COUNT(a.record_id) AS total_check_days,
                    SUM(CASE WHEN a.status = '正常' THEN 1 ELSE 0 END) AS normal_count,
                    SUM(CASE WHEN a.status = '迟到' THEN 1 ELSE 0 END) AS late_count,
                    SUM(CASE WHEN a.status = '早退' THEN 1 ELSE 0 END) AS early_count,
                    SUM(CASE WHEN a.status = '旷工' THEN 1 ELSE 0 END) AS absent_count,
                    SUM(CASE WHEN a.status = '请假' THEN 1 ELSE 0 END) AS leave_count,
                    SUM(a.actual_hours) AS total_hours
                FROM Departments d
                LEFT JOIN Teachers t ON d.dept_id = t.dept_id AND t.is_active = 1
                LEFT JOIN Attendance a ON t.teacher_id = a.teacher_id 
                    AND YEAR(a.check_date) = @year AND MONTH(a.check_date) = @month
                GROUP BY d.dept_id, d.dept_name
                ORDER BY d.dept_name
            `);
        
        // 计算总计
        const total = {
            dept_name: '全校总计',
            teacher_count: result.recordset.reduce((s, r) => s + r.teacher_count, 0),
            total_check_days: result.recordset.reduce((s, r) => s + r.total_check_days, 0),
            normal_count: result.recordset.reduce((s, r) => s + r.normal_count, 0),
            late_count: result.recordset.reduce((s, r) => s + r.late_count, 0),
            early_count: result.recordset.reduce((s, r) => s + r.early_count, 0),
            absent_count: result.recordset.reduce((s, r) => s + r.absent_count, 0),
            leave_count: result.recordset.reduce((s, r) => s + r.leave_count, 0),
            total_hours: result.recordset.reduce((s, r) => s + r.total_hours, 0)
        };
        
        res.json({
            departments: result.recordset,
            total
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取全校汇总失败' });
    }
});

// 缺勤教师筛选（当月旷工或迟到超过阈值）
router.get('/absent/:year/:month', authenticate, requireRole('超级管理员', '教务员', '校领导'), async (req, res) => {
    try {
        const { year, month } = req.params;
        const { threshold = 2 } = req.query; // 缺勤天数阈值，默认2天
        
        const pool = await getConnection();
        const result = await pool.request()
            .input('year', sql.Int, parseInt(year))
            .input('month', sql.Int, parseInt(month))
            .input('threshold', sql.Int, parseInt(threshold))
            .query(`
                SELECT 
                    t.teacher_id,
                    t.name,
                    d.dept_name,
                    COUNT(a.record_id) AS total_days,
                    SUM(CASE WHEN a.status IN ('旷工', '迟到', '早退') THEN 1 ELSE 0 END) AS absent_days,
                    SUM(CASE WHEN a.status = '旷工' THEN 1 ELSE 0 END) AS absent_count,
                    SUM(CASE WHEN a.status = '迟到' THEN 1 ELSE 0 END) AS late_count,
                    SUM(CASE WHEN a.status = '早退' THEN 1 ELSE 0 END) AS early_count
                FROM Teachers t
                LEFT JOIN Departments d ON t.dept_id = d.dept_id
                LEFT JOIN Attendance a ON t.teacher_id = a.teacher_id 
                    AND YEAR(a.check_date) = @year AND MONTH(a.check_date) = @month
                WHERE t.is_active = 1
                GROUP BY t.teacher_id, t.name, d.dept_name
                HAVING SUM(CASE WHEN a.status IN ('旷工', '迟到', '早退') THEN 1 ELSE 0 END) >= @threshold
                ORDER BY absent_days DESC
            `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取缺勤教师列表失败' });
    }
});

module.exports = router;