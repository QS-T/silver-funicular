const express = require('express');
const { getConnection, sql } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// 获取所有课程
router.get('/', authenticate, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM Courses ORDER BY course_id');
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取课程列表失败' });
    }
});

// 获取单个课程
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Char(4), id)
            .query('SELECT * FROM Courses WHERE course_id = @id');
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: '课程不存在' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取课程信息失败' });
    }
});

// 新增课程
router.post('/', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { course_id, course_name, hours_per_session, course_type } = req.body;
        if (!course_id || !course_name || !course_type) {
            return res.status(400).json({ error: '课程编号、名称、类型不能为空' });
        }

        const pool = await getConnection();
        const existCheck = await pool.request()
            .input('id', sql.Char(4), course_id)
            .query('SELECT course_id FROM Courses WHERE course_id = @id');
        if (existCheck.recordset.length > 0) {
            return res.status(400).json({ error: '课程编号已存在' });
        }

        await pool.request()
            .input('course_id', sql.Char(4), course_id)
            .input('course_name', sql.NVarChar(50), course_name)
            .input('hours_per_session', sql.Decimal(4,1), hours_per_session || 2)
            .input('course_type', sql.NVarChar(20), course_type)
            .query(`
                INSERT INTO Courses (course_id, course_name, hours_per_session, course_type)
                VALUES (@course_id, @course_name, @hours_per_session, @course_type)
            `);

        res.status(201).json({ message: '课程添加成功', course_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '添加课程失败' });
    }
});

// 更新课程
router.put('/:id', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { id } = req.params;
        const { course_name, hours_per_session, course_type } = req.body;

        const pool = await getConnection();
        const existCheck = await pool.request()
            .input('id', sql.Char(4), id)
            .query('SELECT course_id FROM Courses WHERE course_id = @id');
        if (existCheck.recordset.length === 0) {
            return res.status(404).json({ error: '课程不存在' });
        }

        await pool.request()
            .input('id', sql.Char(4), id)
            .input('course_name', sql.NVarChar(50), course_name)
            .input('hours_per_session', sql.Decimal(4,1), hours_per_session)
            .input('course_type', sql.NVarChar(20), course_type)
            .query(`
                UPDATE Courses SET
                    course_name = @course_name,
                    hours_per_session = @hours_per_session,
                    course_type = @course_type
                WHERE course_id = @id
            `);

        res.json({ message: '课程更新成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新课程失败' });
    }
});

// 删除课程
router.delete('/:id', authenticate, requireRole('超级管理员'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        
        // 检查是否有排班引用
        const refCheck = await pool.request()
            .input('id', sql.Char(4), id)
            .query('SELECT schedule_id FROM Schedules WHERE course_id = @id');
        if (refCheck.recordset.length > 0) {
            return res.status(400).json({ error: '该课程已被排班引用，无法删除' });
        }

        const result = await pool.request()
            .input('id', sql.Char(4), id)
            .query('DELETE FROM Courses WHERE course_id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: '课程不存在' });
        }
        res.json({ message: '课程删除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除课程失败' });
    }
});

module.exports = router;