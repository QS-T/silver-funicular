const express = require('express');
const { getConnection, sql } = require('../config/db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// 教师登录
router.post('/login', async (req, res) => {
    try {
        const { teacher_id, password } = req.body;
        if (!teacher_id || !password) {
            return res.status(400).json({ error: '工号和密码不能为空' });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('teacher_id', sql.Char(4), teacher_id)
            .query(`
                SELECT teacher_id, name, password_hash, is_active 
                FROM Teachers 
                WHERE teacher_id = @teacher_id
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: '工号或密码错误' });
        }

        const teacher = result.recordset[0];
        if (!teacher.is_active ) {
            return res.status(401).json({ error: '账号已停用，请联系管理员' });
        }

        // 密码比对（暂用明文，后续可改用 bcrypt）
        if (teacher.password_hash !== password) {
            return res.status(401).json({ error: '工号或密码错误' });
        }

        // 生成 JWT（角色为教师）
        const token = generateToken({
            teacher_id: teacher.teacher_id,
            name: teacher.name,
            role: '教师'
        });

        res.json({
            token,
            user: {
                teacher_id: teacher.teacher_id,
                name: teacher.name,
                role: '教师'
            }
        });
    } catch (err) {
        console.error('教师登录错误:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

module.exports = router;