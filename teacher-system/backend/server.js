const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { getConnection } = require('./config/db');

// 路由模块
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const courseRoutes = require('./routes/courses');
const scheduleRoutes = require('./routes/schedules');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const reportRoutes = require('./routes/reports');
const teacherAuthRoutes = require('./routes/teacherAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/teacher', teacherAuthRoutes);

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 全局异常处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err.stack);
    res.status(500).json({ error: '服务器内部错误', message: err.message });
});

// 启动服务
async function startServer() {
    try {
        // 初始化数据库连接
        await getConnection();
        app.listen(PORT, () => {
            console.log(`🚀 服务已启动: http://localhost:${PORT}`);
            console.log(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (err) {
        console.error('启动失败:', err.message);
        process.exit(1);
    }
}

startServer();

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务...');
    const { closeConnection } = require('./config/db');
    await closeConnection();
    process.exit(0);
});