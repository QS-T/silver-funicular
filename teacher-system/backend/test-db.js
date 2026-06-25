const sql = require('mssql');

const config = {
    user: 'sa',
    password: '060102',   // ⚠️ 务必改成你的密码
    server: 'localhost',
    port: 1433,               // 固定端口
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function test() {
    try {
        console.log('⏳ 正在连接 (固定端口 1433)...');
        const pool = await sql.connect(config);
        console.log('✅ 连接成功！');
        const result = await pool.request().query('SELECT @@VERSION');
        console.log('SQL Server 版本:', result.recordset[0]['']);
        await sql.close();
    } catch (err) {
        console.error('❌ 连接失败:', err.message);
    }
}
test();