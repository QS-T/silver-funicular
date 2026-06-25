// 清洗时间参数：去除首尾空格，空字符串转为 null，并验证格式
function sanitizeTime(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed === '') {
        return null;
    }
    // 验证格式：HH:mm 或 HH:mm:ss
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
        return null; // 或 throw new Error('时间格式无效')
    }
    return trimmed; // 返回有效的时间字符串
}

const express = require('express');
const { getConnection, sql } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// 获取所有考勤记录（带教师信息）
router.get('/', authenticate, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT a.*, t.name AS teacher_name, d.dept_name
            FROM Attendance a
            LEFT JOIN Teachers t ON a.teacher_id = t.teacher_id
            LEFT JOIN Departments d ON t.dept_id = d.dept_id
            ORDER BY a.check_date DESC, a.record_id
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取考勤记录失败' });
    }
});

// 获取教师个人考勤
router.get('/teacher/:teacher_id', authenticate, async (req, res) => {
    try {
        const { teacher_id } = req.params;
        const { start_date, end_date } = req.query;
        
        const pool = await getConnection();
        let query = `
            SELECT a.*, t.name AS teacher_name
            FROM Attendance a
            LEFT JOIN Teachers t ON a.teacher_id = t.teacher_id
            WHERE a.teacher_id = @teacher_id
        `;
        const request = pool.request();
        request.input('teacher_id', sql.Char(4), teacher_id);
        
        if (start_date) {
            query += ' AND a.check_date >= @start_date';
            request.input('start_date', sql.Date, start_date);
        }
        if (end_date) {
            query += ' AND a.check_date <= @end_date';
            request.input('end_date', sql.Date, end_date);
        }
        query += ' ORDER BY a.check_date DESC';
        
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取教师考勤失败' });
    }
});

// 打卡（上班/下班）
router.post('/clock', authenticate, async (req, res) => {
    try {
        // 清洗所有输入
        const teacher_id = req.body.teacher_id ? req.body.teacher_id.trim() : null;
        const check_date = req.body.check_date ? req.body.check_date.trim() : null;
        const checkIn = sanitizeTime(req.body.check_in);
        const checkOut = sanitizeTime(req.body.check_out);
        const remark = req.body.remark ? req.body.remark.trim() : null;

        if (!teacher_id || !check_date) {
            return res.status(400).json({ error: '教师ID和日期不能为空' });
        }

        // 如果前端传递了时间但清洗后变为 null，说明格式无效
        if (req.body.check_in && checkIn === null) {
            return res.status(400).json({ error: '上班时间格式无效，请使用 HH:mm 或 HH:mm:ss' });
        }
        if (req.body.check_out && checkOut === null) {
            return res.status(400).json({ error: '下班时间格式无效，请使用 HH:mm 或 HH:mm:ss' });
        }

        const pool = await getConnection();
        
        // 检查是否已有记录
        const existCheck = await pool.request()
            .input('teacher_id', sql.Char(4), teacher_id)
            .input('check_date', sql.Date, check_date)
            .query('SELECT record_id, check_in, check_out FROM Attendance WHERE teacher_id = @teacher_id AND check_date = @check_date');
        
        let record_id;
        if (existCheck.recordset.length > 0) {
            // 更新已有记录
            const existing = existCheck.recordset[0];
            const updateIn = checkIn || existing.check_in;
            const updateOut = checkOut || existing.check_out;
            
            if (!updateIn && !updateOut) {
                return res.status(400).json({ error: '请提供上班或下班打卡时间' });
            }
            
            await pool.request()
                .input('record_id', sql.Char(4), existing.record_id)
                .input('check_in', sql.Time(0), updateIn)
                .input('check_out', sql.Time(0), updateOut)
                .input('remark', sql.NVarChar(200), remark)
                .query(`
                    UPDATE Attendance SET
                        check_in = COALESCE(@check_in, check_in),
                        check_out = COALESCE(@check_out, check_out),
                        remark = COALESCE(@remark, remark)
                    WHERE record_id = @record_id
                `);
            record_id = existing.record_id;
        } else {
            // 新增记录
            if (!checkIn && !checkOut) {
                return res.status(400).json({ error: '请提供上班或下班打卡时间' });
            }
            
            // 生成record_id
            const idResult = await pool.request()
                .query("SELECT 'K' + RIGHT('000' + CAST(ISNULL(MAX(CAST(SUBSTRING(record_id, 2, 3) AS INT)), 0) + 1 AS VARCHAR(3)), 3) AS new_id FROM Attendance");
            record_id = idResult.recordset[0].new_id;
            
            await pool.request()
                .input('record_id', sql.Char(4), record_id)
                .input('teacher_id', sql.Char(4), teacher_id)
                .input('check_date', sql.Date, check_date)
                .input('check_in', sql.Time(0), checkIn)
                .input('check_out', sql.Time(0), checkOut)
                .input('remark', sql.NVarChar(200), remark)
                .query(`
                    INSERT INTO Attendance (record_id, teacher_id, check_date, check_in, check_out, remark)
                    VALUES (@record_id, @teacher_id, @check_date, @check_in, @check_out, @remark)
                `);
        }
        
        // 获取更新后的记录
        const result = await pool.request()
            .input('record_id', sql.Char(4), record_id)
            .query('SELECT * FROM Attendance WHERE record_id = @record_id');
        
        res.json({ 
            message: '打卡成功', 
            record: result.recordset[0]
        });
    } catch (err) {
        console.error('打卡详细错误:', err);
        res.status(500).json({ error: err.message });
    }
});

// 修改考勤记录（教务员/管理员）
router.put('/:record_id', authenticate, requireRole('超级管理员', '教务员'), async (req, res) => {
    try {
        const { record_id } = req.params;
        const { check_in, check_out, status, remark } = req.body;

        const pool = await getConnection();
        const existCheck = await pool.request()
            .input('record_id', sql.Char(4), record_id)
            .query('SELECT record_id FROM Attendance WHERE record_id = @record_id');
        if (existCheck.recordset.length === 0) {
            return res.status(404).json({ error: '考勤记录不存在' });
        }

        await pool.request()
            .input('record_id', sql.Char(4), record_id)
            .input('check_in', sql.Time(0), check_in)
            .input('check_out', sql.Time(0), check_out)
            .input('status', sql.NVarChar(10), status)
            .input('remark', sql.NVarChar(200), remark)
            .query(`
                UPDATE Attendance SET
                    check_in = COALESCE(@check_in, check_in),
                    check_out = COALESCE(@check_out, check_out),
                    status = COALESCE(@status, status),
                    remark = COALESCE(@remark, remark)
                WHERE record_id = @record_id
            `);

        res.json({ message: '考勤记录更新成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新考勤记录失败' });
    }
});

// 删除考勤记录
router.delete('/:record_id', authenticate, requireRole('超级管理员'), async (req, res) => {
    try {
        const { record_id } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('record_id', sql.Char(4), record_id)
            .query('DELETE FROM Attendance WHERE record_id = @record_id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: '考勤记录不存在' });
        }
        res.json({ message: '考勤记录删除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除考勤记录失败' });
    }
});

module.exports = router;