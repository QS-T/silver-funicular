/*const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};*/
const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST, 
    port:1433,
    database: process.env.DB_NAME,  // 这里写 'localhost' 或 '127.0.0.1'
    options: {
        instanceName: 'SQLEXPRESS',        // ✅ 指定 Express 实例名
        encrypt: false,                    // 本地开发可关闭
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// ... 其余代码不变
let pool = null;

async function getConnection() {
    try {
        if (pool) {
            return pool;
        }
        pool = await sql.connect(config);
        console.log('✅ 数据库连接成功');
        return pool;
    } catch (err) {
        console.error('❌ 数据库连接失败:', err.message);
        throw err;
    }
}

async function closeConnection() {
    try {
        if (pool) {
            await pool.close();
            pool = null;
            console.log('数据库连接已关闭');
        }
    } catch (err) {
        console.error('关闭连接失败:', err.message);
    }
}

module.exports = { getConnection, closeConnection, sql };