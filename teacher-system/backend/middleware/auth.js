const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_2026';

// 生成JWT
function generateToken(user) {
    return jwt.sign(
        {
            admin_id: user.admin_id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// 验证JWT中间件
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '认证令牌已过期' });
        }
        return res.status(401).json({ error: '无效的认证令牌' });
    }
}

// 角色权限检查
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '未认证' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: '权限不足，需要角色: ' + roles.join(' 或 ') });
        }
        next();
    };
}

module.exports = { generateToken, authenticate, requireRole };