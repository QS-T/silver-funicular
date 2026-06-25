const express = require('express');
const { getConnection, sql } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// 获取所有教师（带部门信息）
router.get('/', authenticate, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT t.*, d.dept_name 
            FROM Teachers t
            LEFT JOIN Departments d ON t.dept_id = d.dept_id
            WHERE t.is_active = 1
            ORDER BY t.teacher_id
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取教师列表失败' });
    }
});

// 获取单个教师
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Char(4), id)
            .query(`
                SELECT t.*, d.dept_name 
                FROM Teachers t
                LEFT JOIN Departments d ON t.dept_id = d.dept_id
                WHERE t.teacher_id = @id
            `);
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: '教师不存在' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取教师信息失败' });
    }
});

// 新增教师（仅管理员）
/*router.post('/', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { teacher_id, name, gender, hire_date, position, standard_hours, phone, dept_id } = req.body;
        
        // 基本验证
        if (!teacher_id || !name || !gender || !hire_date || !position || !phone || !dept_id) {
            return res.status(400).json({ error: '所有必填字段不能为空' });
        }

        const pool = await getConnection();
        
        // 检查工号是否已存在
        const existCheck = await pool.request()
            .input('id', sql.Char(4), teacher_id)
            .query('SELECT teacher_id FROM Teachers WHERE teacher_id = @id');
        if (existCheck.recordset.length > 0) {
            return res.status(400).json({ error: '工号已存在' });
        }

        await pool.request()
            .input('teacher_id', sql.Char(4), teacher_id)
            .input('name', sql.NVarChar(20), name)
            .input('gender', sql.NChar(1), gender)
            .input('hire_date', sql.Date, hire_date)
            .input('position', sql.NVarChar(30), position)
            .input('standard_hours', sql.Int, standard_hours || 140)
            .input('phone', sql.VarChar(15), phone)
            .input('dept_id', sql.Char(3), dept_id)
            .input('is_active', sql.Bit, 1)
            .query(`
                INSERT INTO Teachers 
                (teacher_id, name, gender, hire_date, position, standard_hours, phone, dept_id, is_active)
                VALUES (@teacher_id, @name, @gender, @hire_date, @position, @standard_hours, @phone, @dept_id, @is_active)
            `);

        res.status(201).json({ message: '教师添加成功', teacher_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '添加教师失败' });
    }
});*/
router.post('/', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { teacher_id, name, gender, hire_date, position, standard_hours, phone, dept_id } = req.body;
        
        // 基本验证（略）
        
        const pool = await getConnection();
        
        // 1. 检查工号是否存在（包括已删除的记录）
        const existCheck = await pool.request()
            .input('id', sql.Char(4), teacher_id)
            .query('SELECT teacher_id, is_active FROM Teachers WHERE teacher_id = @id');
        
        // 2. 检查手机号是否被其他**在职**教师占用
        const phoneCheck = await pool.request()
            .input('phone', sql.VarChar(15), phone)
            .input('id', sql.Char(4), teacher_id)
            .query('SELECT teacher_id FROM Teachers WHERE phone = @phone AND teacher_id != @id AND is_active = 1');
        if (phoneCheck.recordset.length > 0) {
            return res.status(400).json({ error: '手机号已被其他在职教师使用' });
        }
        
        if (existCheck.recordset.length > 0) {
            // 工号已存在（无论是否在职），执行更新（复职）
            const existing = existCheck.recordset[0];
            await pool.request()
                .input('id', sql.Char(4), teacher_id)
                .input('name', sql.NVarChar(20), name)
                .input('gender', sql.NChar(1), gender)
                .input('hire_date', sql.Date, hire_date)
                .input('position', sql.NVarChar(30), position)
                .input('standard_hours', sql.Int, standard_hours || 140)
                .input('phone', sql.VarChar(15), phone)
                .input('dept_id', sql.Char(3), dept_id)
                .input('is_active', sql.Bit, 1)   // 强制激活
                .query(`
                    UPDATE Teachers SET
                        name = @name,
                        gender = @gender,
                        hire_date = @hire_date,
                        position = @position,
                        standard_hours = @standard_hours,
                        phone = @phone,
                        dept_id = @dept_id,
                        is_active = @is_active
                    WHERE teacher_id = @id
                `);
            res.json({ message: '教师信息已更新（复职成功）', teacher_id });
        } else {
            // 工号不存在，执行插入
            await pool.request()
                .input('teacher_id', sql.Char(4), teacher_id)
                .input('name', sql.NVarChar(20), name)
                .input('gender', sql.NChar(1), gender)
                .input('hire_date', sql.Date, hire_date)
                .input('position', sql.NVarChar(30), position)
                .input('standard_hours', sql.Int, standard_hours || 140)
                .input('phone', sql.VarChar(15), phone)
                .input('dept_id', sql.Char(3), dept_id)
                .input('is_active', sql.Bit, 1)
                .query(`
                    INSERT INTO Teachers 
                    (teacher_id, name, gender, hire_date, position, standard_hours, phone, dept_id, is_active)
                    VALUES (@teacher_id, @name, @gender, @hire_date, @position, @standard_hours, @phone, @dept_id, @is_active)
                `);
            res.status(201).json({ message: '教师添加成功', teacher_id });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '处理教师信息失败' });
    }
});

// 更新教师信息
router.put('/:id', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, gender, hire_date, position, standard_hours, phone, dept_id, is_active } = req.body;

        const pool = await getConnection();
        
        // 检查教师是否存在
        const existCheck = await pool.request()
            .input('id', sql.Char(4), id)
            .query('SELECT teacher_id FROM Teachers WHERE teacher_id = @id');
        if (existCheck.recordset.length === 0) {
            return res.status(404).json({ error: '教师不存在' });
        }

        await pool.request()
            .input('id', sql.Char(4), id)
            .input('name', sql.NVarChar(20), name)
            .input('gender', sql.NChar(1), gender)
            .input('hire_date', sql.Date, hire_date)
            .input('position', sql.NVarChar(30), position)
            .input('standard_hours', sql.Int, standard_hours)
            .input('phone', sql.VarChar(15), phone)
            .input('dept_id', sql.Char(3), dept_id)
            .input('is_active', sql.Bit, is_active !== undefined ? is_active : 1)
            .query(`
                UPDATE Teachers SET
                    name = @name,
                    gender = @gender,
                    hire_date = @hire_date,
                    position = @position,
                    standard_hours = @standard_hours,
                    phone = @phone,
                    dept_id = @dept_id,
                    is_active = @is_active
                WHERE teacher_id = @id
            `);

        res.json({ message: '教师信息更新成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新教师信息失败' });
    }
});

// 删除教师（软删除）
router.delete('/:id', authenticate, requireRole('超级管理员'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();
        
        const existCheck = await pool.request()
            .input('id', sql.Char(4), id)
            .query('SELECT teacher_id FROM Teachers WHERE teacher_id = @id AND is_active = 1');
        if (existCheck.recordset.length === 0) {
            return res.status(404).json({ error: '教师不存在或已删除' });
        }

        await pool.request()
            .input('id', sql.Char(4), id)
            .query('UPDATE Teachers SET is_active = 0 WHERE teacher_id = @id');

        res.json({ message: '教师已离职（软删除）' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除教师失败' });
    }
});

module.exports = router;