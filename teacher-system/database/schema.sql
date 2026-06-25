-- ============================================================
-- 教师课时考勤管理系统 - 数据库重建脚本（修复编码与外键）
-- SQL Server 2025
-- 说明：所有中文字段使用 NVARCHAR/NCHAR，插入数据使用 N 前缀
-- ============================================================

USE master;
GO

-- 如果数据库已存在则删除（谨慎！）
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'TeacherAttendanceDB')
BEGIN
    ALTER DATABASE TeacherAttendanceDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE TeacherAttendanceDB;
END
GO

-- 创建数据库
CREATE DATABASE TeacherAttendanceDB;
GO

USE TeacherAttendanceDB;
GO

-- ============================================================
-- 1. 部门表
-- ============================================================
CREATE TABLE Departments (
    dept_id      CHAR(3)      PRIMARY KEY,          -- D01
    dept_name    NVARCHAR(50) NOT NULL UNIQUE,
    manager      NVARCHAR(20) NOT NULL
);
GO

-- ============================================================
-- 2. 教师表（修复：gender 改为 NCHAR(1)）
-- ============================================================
CREATE TABLE Teachers (
    teacher_id    CHAR(4)      PRIMARY KEY,
    name          NVARCHAR(20) NOT NULL,
    gender        NCHAR(1)     NOT NULL CHECK (gender IN (N'男', N'女')),
    hire_date     DATE         NOT NULL,
    position      NVARCHAR(30) NOT NULL,
    standard_hours INT         NOT NULL DEFAULT 140,
    phone         VARCHAR(15)  NOT NULL UNIQUE,
    dept_id       CHAR(3)      NOT NULL,
    is_active     BIT          NOT NULL DEFAULT 1,
    CONSTRAINT FK_Teacher_Dept FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)
);
GO

-- ============================================================
-- 3. 课程表
-- ============================================================
CREATE TABLE Courses (
    course_id        CHAR(4)      PRIMARY KEY,
    course_name      NVARCHAR(50) NOT NULL UNIQUE,
    hours_per_session DECIMAL(4,1) NOT NULL DEFAULT 2,
    course_type      NVARCHAR(20) NOT NULL
);
GO

-- ============================================================
-- 4. 排班表
-- ============================================================
CREATE TABLE Schedules (
    schedule_id   CHAR(4)      PRIMARY KEY,
    teacher_id    CHAR(4)      NOT NULL,
    course_id     CHAR(4)      NOT NULL,
    class_time    NVARCHAR(50) NOT NULL,
    classroom     NVARCHAR(50) NOT NULL,
    weeks         NVARCHAR(20) NOT NULL,
    semester      NVARCHAR(20) NOT NULL DEFAULT N'2025-2026-1',
    is_active     BIT          NOT NULL DEFAULT 1,
    CONSTRAINT FK_Schedule_Teacher FOREIGN KEY (teacher_id) REFERENCES Teachers(teacher_id),
    CONSTRAINT FK_Schedule_Course FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);
GO

-- ============================================================
-- 5. 考勤打卡表
-- ============================================================
CREATE TABLE Attendance (
    record_id     CHAR(4)      PRIMARY KEY,
    teacher_id    CHAR(4)      NOT NULL,
    check_date    DATE         NOT NULL,
    check_in      TIME(0),
    check_out     TIME(0),
    status        NVARCHAR(10) NOT NULL DEFAULT N'正常',
    actual_hours  DECIMAL(5,2) DEFAULT 0,
    remark        NVARCHAR(200),
    CONSTRAINT FK_Attendance_Teacher FOREIGN KEY (teacher_id) REFERENCES Teachers(teacher_id),
    CONSTRAINT UQ_Attendance_Teacher_Date UNIQUE (teacher_id, check_date)
);
GO

-- ============================================================
-- 6. 请假表
-- ============================================================
CREATE TABLE Leaves (
    leave_id      CHAR(4)      PRIMARY KEY,
    teacher_id    CHAR(4)      NOT NULL,
    leave_type    NVARCHAR(20) NOT NULL,
    start_date    DATE         NOT NULL,
    end_date      DATE         NOT NULL,
    reason        NVARCHAR(200) NOT NULL,
    status        NVARCHAR(10) NOT NULL DEFAULT N'待审核',
    approver      NVARCHAR(20),
    approve_time  DATETIME,
    created_at    DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Leave_Teacher FOREIGN KEY (teacher_id) REFERENCES Teachers(teacher_id),
    CONSTRAINT CK_Leave_Date CHECK (start_date <= end_date)
);
GO

-- ============================================================
-- 7. 管理员表
-- ============================================================
CREATE TABLE Admins (
    admin_id      INT          IDENTITY(1,1) PRIMARY KEY,
    username      VARCHAR(30)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role          NVARCHAR(20) NOT NULL,
    permissions   NVARCHAR(200),
    created_at    DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- 索引优化
-- ============================================================
CREATE INDEX IDX_Attendance_Teacher_Date ON Attendance(teacher_id, check_date);
CREATE INDEX IDX_Attendance_Status ON Attendance(status);
CREATE INDEX IDX_Leaves_Teacher_Status ON Leaves(teacher_id, status);
CREATE INDEX IDX_Leaves_Date ON Leaves(start_date, end_date);
CREATE INDEX IDX_Schedules_Teacher ON Schedules(teacher_id);
CREATE INDEX IDX_Schedules_Course ON Schedules(course_id);
GO

-- ============================================================
-- 插入初始数据（全部使用 N 前缀）
-- ============================================================

-- 部门数据
INSERT INTO Departments VALUES
(N'D01', N'英语教研组', N'李四'),
(N'D02', N'数学教研组', N'王五'),
(N'D03', N'计算机教研室', N'李硕'),
(N'D04', N'行政教务部', N'张三');
GO

-- 教师数据（gender 使用 N'男' / N'女'）
INSERT INTO Teachers VALUES
(N'T001', N'张三', N'男', '2018-09-01', N'教研组长', 120, '13500112201', N'D01', 1),
(N'T002', N'李四', N'女', '2020-09-01', N'任课教师', 140, '13500112202', N'D01', 1),
(N'T003', N'王五', N'男', '2019-09-01', N'任课教师', 140, '13500112203', N'D02', 1),
(N'T004', N'李硕', N'女', '2021-09-01', N'任课教师', 140, '13500112204', N'D03', 1),
(N'T005', N'赵二', N'男', '2017-09-01', N'教研室主任', 110, '13500112205', N'D03', 1);
GO

-- 课程数据
INSERT INTO Courses VALUES
(N'C001', N'大学英语', 2, N'必修'),
(N'C002', N'高等数学', 2, N'必修'),
(N'C003', N'Python程序设计', 2, N'实训课'),
(N'C004', N'计算机网络', 2, N'选修'),
(N'C005', N'应用文写作', 1, N'公共课');
GO

-- 排班数据
INSERT INTO Schedules VALUES
(N'P001', N'T001', N'C001', N'周一08:00-09:40', N'101教室', N'1-18周', N'2025-2026-1', 1),
(N'P002', N'T002', N'C001', N'周三14:00-15:40', N'102教室', N'1-18周', N'2025-2026-1', 1),
(N'P003', N'T003', N'C002', N'周二10:00-11:40', N'201教室', N'1-18周', N'2025-2026-1', 1),
(N'P004', N'T004', N'C003', N'周四08:00-10:30', N'机房301', N'1-16周', N'2025-2026-1', 1),
(N'P005', N'T005', N'C004', N'周五15:00-16:40', N'机房302', N'1-18周', N'2025-2026-1', 1);
GO

-- 考勤打卡数据
INSERT INTO Attendance VALUES
(N'K001', N'T001', '2026-06-20', '07:52:10', '17:30:22', N'正常', 0, NULL),
(N'K002', N'T002', '2026-06-20', '08:15:33', '17:22:10', N'迟到', 0, NULL),
(N'K003', N'T003', '2026-06-20', '07:48:05', '16:50:44', N'正常', 0, NULL),
(N'K004', N'T004', '2026-06-20', '08:02:18', '18:10:36', N'正常', 0, NULL),
(N'K005', N'T005', '2026-06-20', '09:20:01', '15:00:20', N'旷工', 0, NULL);
GO

-- 请假数据
INSERT INTO Leaves VALUES
(N'L001', N'T002', N'病假', '2026-06-22', '2026-06-23', N'感冒发烧就医', N'已通过', N'邵坤', GETDATE(), GETDATE()),
(N'L002', N'T005', N'事假', '2026-06-25', '2026-06-25', N'家中急事处理', N'待审核', NULL, NULL, GETDATE()),
(N'L003', N'T001', N'调课', '2026-06-28', '2026-06-28', N'外出教研培训', N'已驳回', N'邵坤', GETDATE(), GETDATE());
GO

-- 管理员数据（密码明文，实际应用应加密）
INSERT INTO Admins (username, password_hash, role, permissions) VALUES
(N'admin', N'123456', N'超级管理员', N'全部权限'),
(N'jiaowu1', N'jiaowu@123', N'教务员', N'排课、审核请假、导出报表'),
(N'leader1', N'leader@666', N'校领导', N'考勤数据查询、课时统计查看');
GO

-- ============================================================
-- 存储过程
-- ============================================================

-- 1. 月度课时核算
CREATE OR ALTER PROCEDURE sp_CalculateMonthlyHours
    @year INT,
    @month INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE a
    SET a.actual_hours = 
        CASE 
            WHEN a.status IN (N'旷工', N'请假') THEN 0
            ELSE ISNULL((
                SELECT SUM(c.hours_per_session) 
                FROM Schedules s
                JOIN Courses c ON s.course_id = c.course_id
                WHERE s.teacher_id = a.teacher_id
                  AND s.is_active = 1
                  AND DATEPART(WEEKDAY, a.check_date) = 
                      CASE 
                          WHEN s.class_time LIKE N'周一%' THEN 1
                          WHEN s.class_time LIKE N'周二%' THEN 2
                          WHEN s.class_time LIKE N'周三%' THEN 3
                          WHEN s.class_time LIKE N'周四%' THEN 4
                          WHEN s.class_time LIKE N'周五%' THEN 5
                          WHEN s.class_time LIKE N'周六%' THEN 6
                          WHEN s.class_time LIKE N'周日%' THEN 7
                      END
            ), 0)
        END
    FROM Attendance a
    WHERE YEAR(a.check_date) = @year AND MONTH(a.check_date) = @month;
    
    SELECT 
        t.teacher_id,
        t.name,
        d.dept_name,
        COUNT(a.record_id) AS work_days,
        SUM(CASE WHEN a.status = N'正常' THEN 1 ELSE 0 END) AS normal_days,
        SUM(CASE WHEN a.status = N'迟到' THEN 1 ELSE 0 END) AS late_days,
        SUM(CASE WHEN a.status = N'早退' THEN 1 ELSE 0 END) AS early_days,
        SUM(CASE WHEN a.status = N'旷工' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN a.status = N'请假' THEN 1 ELSE 0 END) AS leave_days,
        SUM(a.actual_hours) AS total_hours
    FROM Teachers t
    LEFT JOIN Attendance a ON t.teacher_id = a.teacher_id 
        AND YEAR(a.check_date) = @year AND MONTH(a.check_date) = @month
    LEFT JOIN Departments d ON t.dept_id = d.dept_id
    WHERE t.is_active = 1
    GROUP BY t.teacher_id, t.name, d.dept_name
    ORDER BY d.dept_name, t.name;
END
GO

-- 2. 部门考勤报表
CREATE OR ALTER PROCEDURE sp_GenerateDepartmentReport
    @dept_id CHAR(3),
    @year INT,
    @month INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        t.teacher_id,
        t.name,
        t.position,
        COUNT(a.record_id) AS check_days,
        SUM(CASE WHEN a.status = N'正常' THEN 1 ELSE 0 END) AS normal_count,
        SUM(CASE WHEN a.status = N'迟到' THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN a.status = N'早退' THEN 1 ELSE 0 END) AS early_count,
        SUM(CASE WHEN a.status = N'旷工' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN a.status = N'请假' THEN 1 ELSE 0 END) AS leave_count,
        SUM(a.actual_hours) AS total_teaching_hours,
        t.standard_hours,
        (SUM(a.actual_hours) - t.standard_hours) AS hours_diff
    FROM Teachers t
    LEFT JOIN Attendance a ON t.teacher_id = a.teacher_id 
        AND YEAR(a.check_date) = @year AND MONTH(a.check_date) = @month
    WHERE t.dept_id = @dept_id AND t.is_active = 1
    GROUP BY t.teacher_id, t.name, t.position, t.standard_hours
    ORDER BY t.name;
END
GO

-- 3. 教师个人月度汇总
CREATE OR ALTER PROCEDURE sp_TeacherMonthlySummary
    @teacher_id CHAR(4),
    @year INT,
    @month INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        t.teacher_id,
        t.name,
        t.position,
        d.dept_name,
        COUNT(a.record_id) AS work_days,
        SUM(CASE WHEN a.status = N'正常' THEN 1 ELSE 0 END) AS normal_days,
        SUM(CASE WHEN a.status = N'迟到' THEN 1 ELSE 0 END) AS late_days,
        SUM(CASE WHEN a.status = N'早退' THEN 1 ELSE 0 END) AS early_days,
        SUM(CASE WHEN a.status = N'旷工' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN a.status = N'请假' THEN 1 ELSE 0 END) AS leave_days,
        SUM(a.actual_hours) AS total_hours,
        t.standard_hours,
        (SUM(a.actual_hours) - t.standard_hours) AS hours_diff
    FROM Teachers t
    LEFT JOIN Attendance a ON t.teacher_id = a.teacher_id 
        AND YEAR(a.check_date) = @year AND MONTH(a.check_date) = @month
    LEFT JOIN Departments d ON t.dept_id = d.dept_id
    WHERE t.teacher_id = @teacher_id
    GROUP BY t.teacher_id, t.name, t.position, d.dept_name, t.standard_hours;
END
GO

-- ============================================================
-- 触发器（使用 N 前缀匹配）
-- ============================================================

-- 1. 打卡超时自动标记迟到（上班时间 > 08:00 为迟到）
CREATE OR ALTER TRIGGER trg_CheckLateOnInsert
ON Attendance
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO Attendance (record_id, teacher_id, check_date, check_in, check_out, status, actual_hours, remark)
    SELECT 
        record_id,
        teacher_id,
        check_date,
        check_in,
        check_out,
        CASE 
            WHEN check_in IS NOT NULL AND CAST(check_in AS TIME) > '08:00:00' THEN N'迟到'
            WHEN check_in IS NOT NULL AND CAST(check_in AS TIME) <= '08:00:00' THEN N'正常'
            ELSE N'旷工'
        END AS status,
        0 AS actual_hours,
        remark
    FROM inserted;
END
GO

-- 2. 请假审批更新考勤状态
CREATE OR ALTER TRIGGER trg_LeaveApprovalUpdate
ON Leaves
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 审核通过 → 将对应日期考勤标记为“请假”
    UPDATE a
    SET a.status = N'请假',
        a.remark = N'请假审批通过: ' + i.leave_type
    FROM Attendance a
    INNER JOIN inserted i ON a.teacher_id = i.teacher_id
    INNER JOIN deleted d ON i.leave_id = d.leave_id
    WHERE a.check_date BETWEEN i.start_date AND i.end_date
      AND i.status = N'已通过'
      AND d.status != N'已通过';
    
    -- 审核驳回 → 恢复为“正常”（仅当无打卡记录时）
    UPDATE a
    SET a.status = N'正常',
        a.remark = NULL
    FROM Attendance a
    INNER JOIN inserted i ON a.teacher_id = i.teacher_id
    INNER JOIN deleted d ON i.leave_id = d.leave_id
    WHERE a.check_date BETWEEN i.start_date AND i.end_date
      AND i.status = N'已驳回'
      AND d.status = N'已通过'
      AND a.check_in IS NULL
      AND a.check_out IS NULL;
END
GO

-- 3. 下班打卡自动判断早退（17:00 之前下班）
CREATE OR ALTER TRIGGER trg_AutoCheckStatusOnUpdate
ON Attendance
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE a
    SET a.status = 
        CASE 
            WHEN a.status = N'迟到' AND a.check_out IS NOT NULL AND CAST(a.check_out AS TIME) < '17:00:00' THEN N'迟到+早退'
            WHEN a.status = N'正常' AND a.check_out IS NOT NULL AND CAST(a.check_out AS TIME) < '17:00:00' THEN N'早退'
            WHEN a.status = N'迟到' THEN N'迟到'
            WHEN a.status = N'正常' THEN N'正常'
            ELSE a.status
        END
    FROM Attendance a
    INNER JOIN inserted i ON a.record_id = i.record_id
    WHERE i.check_out IS NOT NULL
      AND (i.status != N'请假' AND i.status != N'旷工');
END
GO

PRINT N'✅ 数据库重建完成！所有表、数据、存储过程、触发器已创建。';
GO

SELECT * FROM Teachers;
SELECT * FROM Attendance;
SELECT * FROM Leaves;

USE TeacherAttendanceDB;
GO

-- 1. 添加 password_hash 列（允许为空，以便后续更新）
ALTER TABLE Teachers ADD password_hash NVARCHAR(100) NULL;
GO

-- 2. 为所有现有教师设置默认密码（例如 '123456'）
UPDATE Teachers SET password_hash = '123456' WHERE password_hash IS NULL;
GO

-- 3. 将该列改为 NOT NULL（确保以后插入都有密码）
ALTER TABLE Teachers ALTER COLUMN password_hash NVARCHAR(100) NOT NULL;
GO

INSERT INTO Attendance (record_id, teacher_id, check_date, check_in, check_out, status)
VALUES ('K999', 'T001', '2026-06-24', '07:49:40', '17:50:01', '正常');
