const express = require('express');
const { getConnection, sql } = require('../config/db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('username', sql.VarChar(30), username)
            .query('SELECT * FROM Admins WHERE username = @username');

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const user = result.recordset[0];
        // 生产环境应使用bcrypt.compare
        if (user.password_hash !== password) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = generateToken({
            admin_id: user.admin_id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        });

        res.json({
            token,
            user: {
                admin_id: user.admin_id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

// 验证令牌
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未提供令牌' });
        }
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_2026');
        res.json({ valid: true, user: decoded });
    } catch (err) {
        res.status(401).json({ valid: false, error: err.message });
    }
});

module.exports = router;