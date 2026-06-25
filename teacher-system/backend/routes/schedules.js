const express = require('express');
const { getConnection, sql } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// 获取所有排班（含教师和课程信息）
router.get('/', authenticate, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT s.*, t.name AS teacher_name, c.course_name, c.hours_per_session
            FROM Schedules s
            LEFT JOIN Teachers t ON s.teacher_id = t.teacher_id
            LEFT JOIN Courses c ON s.course_id = c.course_id
            WHERE s.is_active = 1
            ORDER BY s.schedule_id
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取排班列表失败' });
    }
});

// 获取教师排班
router.get('/teacher/:teacher_id', authenticate, async (req, res) => {
    try {
        const { teacher_id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('teacher_id', sql.Char(4), teacher_id)
            .query(`
                SELECT s.*, c.course_name, c.hours_per_session
                FROM Schedules s
                JOIN Courses c ON s.course_id = c.course_id
                WHERE s.teacher_id = @teacher_id AND s.is_active = 1
                ORDER BY s.class_time
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取教师排班失败' });
    }
});

// 新增排班
router.post('/', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { schedule_id, teacher_id, course_id, class_time, classroom, weeks, semester } = req.body;
        if (!schedule_id || !teacher_id || !course_id || !class_time || !classroom || !weeks) {
            return res.status(400).json({ error: '所有必填字段不能为空' });
        }

        const pool = await getConnection();
        
        // 检查排班编号是否已存在
        const existCheck = await pool.request()
            .input('id', sql.Char(4), schedule_id)
            .query('SELECT schedule_id FROM Schedules WHERE schedule_id = @id');
        if (existCheck.recordset.length > 0) {
            return res.status(400).json({ error: '排班编号已存在' });
        }

        await pool.request()
            .input('schedule_id', sql.Char(4), schedule_id)
            .input('teacher_id', sql.Char(4), teacher_id)
            .input('course_id', sql.Char(4), course_id)
            .input('class_time', sql.NVarChar(50), class_time)
            .input('classroom', sql.NVarChar(50), classroom)
            .input('weeks', sql.NVarChar(20), weeks)
            .input('semester', sql.NVarChar(20), semester || '2025-2026-1')
            .input('is_active', sql.Bit, 1)
            .query(`
                INSERT INTO Schedules 
                (schedule_id, teacher_id, course_id, class_time, classroom, weeks, semester, is_active)
                VALUES (@schedule_id, @teacher_id, @course_id, @class_time, @classroom, @weeks, @semester, @is_active)
            `);

        res.status(201).json({ message: '排班添加成功', schedule_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '添加排班失败' });
    }
});

// 更新排班
router.put('/:id', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { id } = req.params;
        const { teacher_id, course_id, class_time, classroom, weeks, semester, is_active } = req.body;

        const pool = await getConnection();
        const existCheck = await pool.request()
            .input('id', sql.Char(4), id)
            .query('SELECT schedule_id FROM Schedules WHERE schedule_id = @id');
        if (existCheck.recordset.length === 0) {
            return res.status(404).json({ error: '排班不存在' });
        }

        await pool.request()
            .input('id', sql.Char(4), id)
            .input('teacher_id', sql.Char(4), teacher_id)
            .input('course_id', sql.Char(4), course_id)
            .input('class_time', sql.NVarChar(50), class_time)
            .input('classroom', sql.NVarChar(50), classroom)
            .input('weeks', sql.NVarChar(20), weeks)
            .input('semester', sql.NVarChar(20), semester)
            .input('is_active', sql.Bit, is_active !== undefined ? is_active : 1)
            .query(`
                UPDATE Schedules SET
                    teacher_id = @teacher_id,
                    course_id = @course_id,
                    class_time = @class_time,
                    classroom = @classroom,
                    weeks = @weeks,
                    semester = @semester,
                    is_active = @is_active
                WHERE schedule_id = @id
            `);

        res.json({ message: '排班更新成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新排班失败' });
    }
});

// 删除排班
router.delete('/:id', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        
        // 软删除
        const result = await pool.request()
            .input('id', sql.Char(4), id)
            .query('UPDATE Schedules SET is_active = 0 WHERE schedule_id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: '排班不存在' });
        }
        res.json({ message: '排班已删除' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除排班失败' });
    }
});

module.exports = router;