// ==================== 教师端主逻辑 ====================
// 检查是否已登录
let teacherToken = localStorage.getItem('teacherToken');
let teacherUser = null;
if (teacherToken) {
    try {
        // 简单验证 token 是否有效（可调用 /api/auth/verify，但需修改后端支持教师 token）
        // 为简便，直接认为 token 存在即登录，后续请求会带 token，若 401 则跳转登录
        teacherUser = JSON.parse(localStorage.getItem('teacherUser'));
        showTeacherContent();
    } catch {
        logoutTeacher();
    }
} else {
    // 显示登录界面
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('teacherContent').style.display = 'none';
}

// 登录表单提交
document.getElementById('teacherLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const teacher_id = document.getElementById('teacherLoginId').value.trim();
    const password = document.getElementById('teacherLoginPassword').value.trim();
    const errorEl = document.getElementById('teacherLoginError');
    errorEl.textContent = '';
    
    if (!teacher_id || !password) {
        errorEl.textContent = '请填写完整信息';
        return;
    }
    
    try {
       const response = await fetch(API_BASE + '/teacher/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacher_id, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '登录失败');
        }
        // 保存 token 和用户信息
        localStorage.setItem('teacherToken', data.token);
        localStorage.setItem('teacherUser', JSON.stringify(data.user));
        teacherUser = data.user;
        showTeacherContent();
    } catch (err) {
        errorEl.textContent = err.message;
    }
});

function showTeacherContent() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('teacherContent').style.display = 'block';
    // 初始化教师端界面（原 DOMContentLoaded 中的初始化代码）
    initTeacherApp();
}

function logoutTeacher() {
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherUser');
    window.location.reload();
}

// 将原有 DOMContentLoaded 的内容封装为 initTeacherApp
function initTeacherApp() {
    // 原来 DOMContentLoaded 中的代码
    // 注意：将 TEACHER_ID 改为从 teacherUser 获取
    const user = JSON.parse(localStorage.getItem('teacherUser'));
    if (!user) return;
    const TEACHER_ID = user.teacher_id;
    document.getElementById('userName').textContent = user.name || user.teacher_id;
    document.getElementById('userRole').textContent = '授课教师';
    // ... 其余代码不变，但所有使用 TEACHER_ID 的地方都换成变量
    // 并且所有 API 请求需添加 Authorization 头
    // 因此需修改 API.request 函数，使其自动携带 teacherToken
}

// 在 teacher.js 顶部添加 API 拦截，自动添加 token
// 由于我们使用全局的 API 对象（api.js），需要修改 api.js 的 request 函数，使其支持 teacherToken

document.addEventListener('DOMContentLoaded', function() {
    const user = getUser();
    if (!user || !getToken()) {
        window.location.href = 'index.html';
        return;
    }
    
    // 显示用户信息
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = user.role;
    
    // 当前教师ID（演示用，实际应从登录信息或选择中获取）
    // 这里默认使用 T001，实际系统应由登录教师选择或绑定
    const TEACHER_ID = 'T001';
    
    // 页面状态
    let currentPage = 'dashboard';
    let allAttendance = [];
    let allLeaves = [];
    let allSchedules = [];
    
    // 渲染函数映射
    const renderers = {
        dashboard: renderDashboard,
        clock: renderClock,
        schedule: renderSchedule,
        attendance: renderAttendance,
        leave: renderLeave
    };
    
    // 侧边栏导航
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            switchPage(page);
        });
    });
    
    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('确定要退出登录吗？')) {
            clearToken();
            window.location.href = 'index.html';
        }
    });
    
    // 切换页面
    function switchPage(page) {
        currentPage = page;
        document.querySelectorAll('.nav-item[data-page]').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });
        if (renderers[page]) {
            renderers[page]();
        }
    }
    
    // ==================== 看板 ====================
    async function renderDashboard() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1>📊 我的看板</h1>
                <div class="subtitle">${new Date().toLocaleDateString('zh-CN')}</div>
            </div>
            <div class="stats-grid" id="statsGrid">
                <div class="stat-card"><div class="number blue" id="statTotal">-</div><div class="label">本月总课时</div></div>
                <div class="stat-card"><div class="number green" id="statNormal">-</div><div class="label">正常出勤</div></div>
                <div class="stat-card"><div class="number orange" id="statLate">-</div><div class="label">迟到</div></div>
                <div class="stat-card"><div class="number red" id="statAbsent">-</div><div class="label">旷工</div></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 本月考勤概览</h3></div>
                <div id="dashboardTable"><p style="color:#8a9bb0;">加载中...</p></div>
            </div>
        `;
        
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            
            // 获取月度汇总
            const summary = await API.reports.teacherSummary(TEACHER_ID, year, month);
            if (summary) {
                document.getElementById('statTotal').textContent = summary.total_hours || 0;
                document.getElementById('statNormal').textContent = summary.normal_days || 0;
                document.getElementById('statLate').textContent = summary.late_days || 0;
                document.getElementById('statAbsent').textContent = summary.absent_days || 0;
            }
            
            // 获取本月考勤记录
            const records = await API.attendance.getByTeacher(TEACHER_ID, {
                start_date: `${year}-${String(month).padStart(2,'0')}-01`,
                end_date: `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
            });
            
            const tableHtml = records.length === 0 ? 
                '<p style="color:#8a9bb0;">本月暂无考勤记录</p>' :
                `<div class="table-responsive">
                    <table>
                        <thead><tr><th>日期</th><th>上班打卡</th><th>下班打卡</th><th>状态</th><th>实际课时</th></tr></thead>
                        <tbody>
                            ${records.map(r => `
                                <tr>
                                    <td>${r.check_date}</td>
                                    <td>${r.check_in || '-'}</td>
                                    <td>${r.check_out || '-'}</td>
                                    <td><span class="status-badge ${r.status}">${r.status}</span></td>
                                    <td>${r.actual_hours || 0}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            document.getElementById('dashboardTable').innerHTML = tableHtml;
            
        } catch (err) {
            document.getElementById('dashboardTable').innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
        }
    }
    
    // ==================== 打卡 ====================
    function renderClock() {
        const container = document.getElementById('mainContent');
        const today = new Date().toISOString().split('T')[0];
        container.innerHTML = `
            <div class="page-header">
                <h1>⏰ 打卡</h1>
                <div class="subtitle">${today}</div>
            </div>
            <div class="card">
                <div class="card-header"><h3>今日打卡</h3></div>
                <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
                    <div class="form-group" style="flex:1;min-width:180px;">
                        <label>教师</label>
                        <input type="text" id="clockTeacher" value="${TEACHER_ID}" readonly style="background:#f7fafc;">
                    </div>
                    <div class="form-group" style="flex:1;min-width:180px;">
                        <label>日期</label>
                        <input type="date" id="clockDate" value="${today}">
                    </div>
                    <div class="form-group" style="flex:1;min-width:150px;">
                        <label>上班打卡</label>
                        <input type="time" id="clockIn" step="1">
                    </div>
                    <div class="form-group" style="flex:1;min-width:150px;">
                        <label>下班打卡</label>
                        <input type="time" id="clockOut" step="1">
                    </div>
                    <div style="display:flex; gap:10px; align-self:flex-end; padding-bottom:4px;">
                        <button class="btn btn-primary" id="clockBtn">✅ 打卡</button>
                        <button class="btn btn-outline" id="clockNowBtn">🕐 现在时间</button>
                    </div>
                </div>
                <div id="clockResult" style="margin-top:12px; font-weight:500;"></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 今日考勤状态</h3></div>
                <div id="todayStatus"><p style="color:#8a9bb0;">加载中...</p></div>
            </div>
        `;
        
        // 加载今日状态
        loadTodayStatus();
        
        // 现在时间按钮
        document.getElementById('clockNowBtn').addEventListener('click', function() {
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 8);
            const hour = now.getHours();
            // 自动判断上班/下班：8点前为上班，17点后为下班
            if (hour < 12) {
                document.getElementById('clockIn').value = timeStr;
            } else {
                document.getElementById('clockOut').value = timeStr;
            }
        });
        
        // 打卡按钮
        document.getElementById('clockBtn').addEventListener('click', async function() {
            const teacherId = document.getElementById('clockTeacher').value.trim();
            const checkDate = document.getElementById('clockDate').value;
            const checkIn = document.getElementById('clockIn').value || null;
            const checkOut = document.getElementById('clockOut').value || null;
            
            if (!teacherId || !checkDate) {
                document.getElementById('clockResult').innerHTML = '<span style="color:#e53e3e;">❌ 请填写完整信息</span>';
                return;
            }
            if (!checkIn && !checkOut) {
                document.getElementById('clockResult').innerHTML = '<span style="color:#e53e3e;">❌ 请至少填写上班或下班打卡时间</span>';
                return;
            }
            
            this.disabled = true;
            this.textContent = '提交中...';
            document.getElementById('clockResult').innerHTML = '';
            
            try {
                const result = await API.attendance.clock({
                    teacher_id: teacherId,
                    check_date: checkDate,
                    check_in: checkIn,
                    check_out: checkOut
                });
                document.getElementById('clockResult').innerHTML = `<span style="color:#38a169;">✅ 打卡成功！状态: ${result.record.status}</span>`;
                loadTodayStatus();
                // 清空时间
                document.getElementById('clockIn').value = '';
                document.getElementById('clockOut').value = '';
            } catch (err) {
                document.getElementById('clockResult').innerHTML = `<span style="color:#e53e3e;">❌ ${err.message}</span>`;
            } finally {
                this.disabled = false;
                this.textContent = '✅ 打卡';
            }
        });
    }
    
    async function loadTodayStatus() {
        const today = new Date().toISOString().split('T')[0];
        try {
            const records = await API.attendance.getByTeacher(TEACHER_ID, {
                start_date: today,
                end_date: today
            });
            const container = document.getElementById('todayStatus');
            if (records.length === 0) {
                container.innerHTML = '<p style="color:#8a9bb0;">今日尚未打卡</p>';
            } else {
                const r = records[0];
                container.innerHTML = `
                    <div style="display:flex; gap:20px; flex-wrap:wrap;">
                        <div><strong>日期：</strong>${r.check_date}</div>
                        <div><strong>上班：</strong>${r.check_in || '-'}</div>
                        <div><strong>下班：</strong>${r.check_out || '-'}</div>
                        <div><strong>状态：</strong><span class="status-badge ${r.status}">${r.status}</span></div>
                        <div><strong>实际课时：</strong>${r.actual_hours || 0}</div>
                    </div>
                `;
            }
        } catch (err) {
            document.getElementById('todayStatus').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    // ==================== 排班 ====================
    async function renderSchedule() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1>📅 我的排班</h1>
                <div class="subtitle">当前学期课程安排</div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 排班表</h3></div>
                <div id="scheduleTable"><p style="color:#8a9bb0;">加载中...</p></div>
            </div>
        `;
        
        try {
            const schedules = await API.schedules.getByTeacher(TEACHER_ID);
            const tableHtml = schedules.length === 0 ?
                '<p style="color:#8a9bb0;">暂无排班信息</p>' :
                `<div class="table-responsive">
                    <table>
                        <thead><tr><th>课程</th><th>上课时间</th><th>教室</th><th>周次</th><th>单节课时</th></tr></thead>
                        <tbody>
                            ${schedules.map(s => `
                                <tr>
                                    <td><strong>${s.course_name}</strong></td>
                                    <td>${s.class_time}</td>
                                    <td>${s.classroom}</td>
                                    <td>${s.weeks}</td>
                                    <td>${s.hours_per_session} 课时</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            document.getElementById('scheduleTable').innerHTML = tableHtml;
        } catch (err) {
            document.getElementById('scheduleTable').innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
        }
    }
    
    // ==================== 考勤记录 ====================
    async function renderAttendance() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1>📋 考勤记录</h1>
                <div class="actions">
                    <input type="month" id="filterMonth" value="${new Date().toISOString().slice(0,7)}">
                    <button class="btn btn-primary btn-sm" id="filterBtn">筛选</button>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📊 考勤明细</h3></div>
                <div id="attendanceTable"><p style="color:#8a9bb0;">加载中...</p></div>
            </div>
        `;
        
        await loadAttendanceRecords();
        
        document.getElementById('filterBtn').addEventListener('click', loadAttendanceRecords);
    }
    
    async function loadAttendanceRecords() {
        const monthVal = document.getElementById('filterMonth').value;
        if (!monthVal) return;
        const [year, month] = monthVal.split('-').map(Number);
        const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
        const endDate = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`;
        
        try {
            const records = await API.attendance.getByTeacher(TEACHER_ID, {
                start_date: startDate,
                end_date: endDate
            });
            const tableHtml = records.length === 0 ?
                '<p style="color:#8a9bb0;">该月暂无考勤记录</p>' :
                `<div class="table-responsive">
                    <table>
                        <thead><tr><th>日期</th><th>上班打卡</th><th>下班打卡</th><th>状态</th><th>实际课时</th><th>备注</th></tr></thead>
                        <tbody>
                            ${records.map(r => `
                                <tr>
                                    <td>${r.check_date}</td>
                                    <td>${r.check_in || '-'}</td>
                                    <td>${r.check_out || '-'}</td>
                                    <td><span class="status-badge ${r.status}">${r.status}</span></td>
                                    <td>${r.actual_hours || 0}</td>
                                    <td>${r.remark || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            document.getElementById('attendanceTable').innerHTML = tableHtml;
        } catch (err) {
            document.getElementById('attendanceTable').innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
        }
    }
    
    // ==================== 请假申请 ====================
    async function renderLeave() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1>📝 请假申请</h1>
                <button class="btn btn-primary" id="newLeaveBtn">➕ 提交申请</button>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 我的请假记录</h3></div>
                <div id="leaveTable"><p style="color:#8a9bb0;">加载中...</p></div>
            </div>
            <!-- 申请表单 (隐藏) -->
            <div id="leaveFormContainer" style="display:none;"></div>
        `;
        
        await loadLeaveRecords();
        
        document.getElementById('newLeaveBtn').addEventListener('click', function() {
            showLeaveForm();
        });
    }
    
    async function loadLeaveRecords() {
        try {
            const leaves = await API.leaves.getByTeacher(TEACHER_ID);
            const tableHtml = leaves.length === 0 ?
                '<p style="color:#8a9bb0;">暂无请假记录</p>' :
                `<div class="table-responsive">
                    <table>
                        <thead><tr><th>编号</th><th>类型</th><th>起止时间</th><th>事由</th><th>状态</th><th>审核人</th></tr></thead>
                        <tbody>
                            ${leaves.map(l => `
                                <tr>
                                    <td>${l.leave_id}</td>
                                    <td>${l.leave_type}</td>
                                    <td>${l.start_date} 至 ${l.end_date}</td>
                                    <td>${l.reason}</td>
                                    <td><span class="status-badge ${l.status === '已通过' ? 'approved' : l.status === '已驳回' ? 'rejected' : 'pending'}">${l.status}</span></td>
                                    <td>${l.approver || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            document.getElementById('leaveTable').innerHTML = tableHtml;
        } catch (err) {
            document.getElementById('leaveTable').innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
        }
    }
    
    function showLeaveForm() {
        const container = document.getElementById('leaveFormContainer');
        if (container.style.display === 'block') {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        container.innerHTML = `
            <div class="card" style="border:2px solid #4a8db7;">
                <div class="card-header">
                    <h3>📝 提交请假申请</h3>
                    <button class="btn btn-outline btn-sm" id="closeLeaveForm">✕ 关闭</button>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>请假编号 *</label>
                        <input type="text" id="leaveId" placeholder="如 L004" value="L004">
                    </div>
                    <div class="form-group">
                        <label>教师 *</label>
                        <input type="text" id="leaveTeacher" value="${TEACHER_ID}" readonly style="background:#f7fafc;">
                    </div>
                    <div class="form-group">
                        <label>请假类型 *</label>
                        <select id="leaveType">
                            <option value="病假">病假</option>
                            <option value="事假" selected>事假</option>
                            <option value="调课">调课</option>
                            <option value="年假">年假</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>开始日期 *</label>
                        <input type="date" id="leaveStart" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label>结束日期 *</label>
                        <input type="date" id="leaveEnd" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group" style="grid-column:1/-1;">
                        <label>事由 *</label>
                        <textarea id="leaveReason" placeholder="请详细描述请假事由..." rows="2"></textarea>
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-top:12px;">
                    <button class="btn btn-primary" id="submitLeaveBtn">提交申请</button>
                    <button class="btn btn-outline" id="cancelLeaveBtn">取消</button>
                </div>
                <div id="leaveFormResult" style="margin-top:10px;"></div>
            </div>
        `;
        
        document.getElementById('closeLeaveForm').addEventListener('click', () => container.style.display = 'none');
        document.getElementById('cancelLeaveBtn').addEventListener('click', () => container.style.display = 'none');
        
        document.getElementById('submitLeaveBtn').addEventListener('click', async function() {
            const leaveId = document.getElementById('leaveId').value.trim();
            const teacherId = document.getElementById('leaveTeacher').value.trim();
            const leaveType = document.getElementById('leaveType').value;
            const startDate = document.getElementById('leaveStart').value;
            const endDate = document.getElementById('leaveEnd').value;
            const reason = document.getElementById('leaveReason').value.trim();
            const resultEl = document.getElementById('leaveFormResult');
            
            if (!leaveId || !teacherId || !startDate || !endDate || !reason) {
                resultEl.innerHTML = '<span style="color:#e53e3e;">❌ 请填写所有必填字段</span>';
                return;
            }
            
            this.disabled = true;
            this.textContent = '提交中...';
            resultEl.innerHTML = '';
            
            try {
                await API.leaves.create({
                    leave_id: leaveId,
                    teacher_id: teacherId,
                    leave_type: leaveType,
                    start_date: startDate,
                    end_date: endDate,
                    reason: reason
                });
                resultEl.innerHTML = '<span style="color:#38a169;">✅ 请假申请已提交，请等待审核</span>';
                container.style.display = 'none';
                await loadLeaveRecords();
            } catch (err) {
                resultEl.innerHTML = `<span style="color:#e53e3e;">❌ ${err.message}</span>`;
            } finally {
                this.disabled = false;
                this.textContent = '提交申请';
            }
        });
    }
    
    // 默认加载看板
    switchPage('dashboard');
});