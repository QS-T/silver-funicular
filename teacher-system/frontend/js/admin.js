// ==================== 教务员端主逻辑 ====================
document.addEventListener('DOMContentLoaded', function() {
    const user = getUser();
    if (!user || !getToken()) {
        window.location.href = 'index.html';
        return;
    }
    if (!['超级管理员', '教务员'].includes(user.role)) {
        alert('您没有教务员权限，将跳转到教师端');
        window.location.href = 'teacher.html';
        return;
    }
    
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = user.role;
    
    // 页面路由
    const routes = {
        dashboard: renderDashboard,
        teachers: renderTeachers,
        courses: renderCourses,
        schedules: renderSchedules,
        attendance: renderAttendance,
        leaves: renderLeaves,
        reports: renderReports
    };
    
    let currentPage = 'dashboard';
    
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (routes[page]) {
                currentPage = page;
                document.querySelectorAll('.nav-item[data-page]').forEach(el => {
                    el.classList.toggle('active', el.dataset.page === page);
                });
                routes[page]();
            }
        });
    });
    
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('确定退出吗？')) {
            clearToken();
            window.location.href = 'index.html';
        }
    });
    
    // 默认加载总览
    renderDashboard();
    
    // ==================== 总览 ====================
    async function renderDashboard() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header"><h1>📊 教务总览</h1></div>
            <div class="stats-grid" id="dashStats">
                <div class="stat-card"><div class="number blue" id="dTotalTeachers">-</div><div class="label">在职教师</div></div>
                <div class="stat-card"><div class="number green" id="dTotalCourses">-</div><div class="label">课程数</div></div>
                <div class="stat-card"><div class="number orange" id="dPendingLeaves">-</div><div class="label">待审核请假</div></div>
                <div class="stat-card"><div class="number red" id="dTodayAbsent">-</div><div class="label">今日缺勤</div></div>
            </div>
            <div class="card"><div class="card-header"><h3>📋 最新考勤</h3></div><div id="dRecentAttendance"><p>加载中...</p></div></div>
        `;
        
        try {
            const [teachers, courses, leaves, attendance] = await Promise.all([
                API.teachers.list(),
                API.courses.list(),
                API.leaves.list(),
                API.attendance.list()
            ]);
            
            document.getElementById('dTotalTeachers').textContent = teachers.length;
            document.getElementById('dTotalCourses').textContent = courses.length;
            document.getElementById('dPendingLeaves').textContent = leaves.filter(l => l.status === '待审核').length;
            
            const today = new Date().toISOString().split('T')[0];
            const todayAbsent = attendance.filter(a => a.check_date === today && ['旷工', '迟到'].includes(a.status));
            document.getElementById('dTodayAbsent').textContent = todayAbsent.length;
            
            const recent = attendance.slice(0, 10);
            const tableHtml = recent.length === 0 ? '<p>暂无记录</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>教师</th><th>日期</th><th>状态</th><th>课时</th></tr></thead>
                    <tbody>${recent.map(a => `
                        <tr>
                            <td>${a.teacher_name || a.teacher_id}</td>
                            <td>${a.check_date}</td>
                            <td><span class="status-badge ${a.status}">${a.status}</span></td>
                            <td>${a.actual_hours || 0}</td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('dRecentAttendance').innerHTML = tableHtml;
        } catch (err) {
            document.getElementById('dRecentAttendance').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    // ==================== 教师管理 ====================
    async function renderTeachers() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header">
                <h1>👨‍🏫 教师管理</h1>
                <button class="btn btn-primary" id="addTeacherBtn">➕ 添加教师</button>
            </div>
            <div class="card"><div class="card-header"><h3>教师列表</h3></div><div id="teacherTable"><p>加载中...</p></div></div>
            <div id="teacherFormContainer" style="display:none;"></div>
        `;
        await loadTeachers();
        document.getElementById('addTeacherBtn').addEventListener('click', () => showTeacherForm());
    }
    
    async function loadTeachers() {
        try {
            const teachers = await API.teachers.list();
            const tableHtml = teachers.length === 0 ? '<p>暂无教师</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>工号</th><th>姓名</th><th>性别</th><th>部门</th><th>岗位</th><th>标准课时</th><th>操作</th></tr></thead>
                    <tbody>${teachers.map(t => `
                        <tr>
                            <td>${t.teacher_id}</td>
                            <td>${t.name}</td>
                            <td>${t.gender}</td>
                            <td>${t.dept_name || t.dept_id}</td>
                            <td>${t.position}</td>
                            <td>${t.standard_hours}</td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="editTeacher('${t.teacher_id}')">编辑</button>
                                <button class="btn btn-danger btn-sm" onclick="deleteTeacher('${t.teacher_id}')">删除</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('teacherTable').innerHTML = tableHtml;
            window.editTeacher = (id) => showTeacherForm(id);
            window.deleteTeacher = async (id) => {
                if (confirm(`确定要删除教师 ${id} 吗？`)) {
                    try {
                        await API.teachers.delete(id);
                        await loadTeachers();
                    } catch (err) { alert('删除失败: ' + err.message); }
                }
            };
        } catch (err) {
            document.getElementById('teacherTable').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    async function showTeacherForm(editId = null) {
        const container = document.getElementById('teacherFormContainer');
        if (container.style.display === 'block' && !editId) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        
        let data = {};
        if (editId) {
            try { data = await API.teachers.get(editId); } catch(e) {}
        }
        
        container.innerHTML = `
            <div class="card" style="border:2px solid #4a8db7;">
                <div class="card-header">
                    <h3>${editId ? '✏️ 编辑教师' : '➕ 添加教师'}</h3>
                    <button class="btn btn-outline btn-sm" id="closeTeacherForm">✕ 关闭</button>
                </div>
                <div class="form-grid">
                    <div class="form-group"><label>工号 *</label><input type="text" id="tfId" value="${data.teacher_id || ''}" ${editId ? 'readonly' : ''}></div>
                    <div class="form-group"><label>姓名 *</label><input type="text" id="tfName" value="${data.name || ''}"></div>
                    <div class="form-group"><label>性别 *</label>
                        <select id="tfGender"><option value="男" ${data.gender==='男'?'selected':''}>男</option><option value="女" ${data.gender==='女'?'selected':''}>女</option></select>
                    </div>
                    <div class="form-group"><label>入职日期 *</label><input type="date" id="tfHire" value="${data.hire_date || ''}"></div>
                    <div class="form-group"><label>岗位 *</label><input type="text" id="tfPosition" value="${data.position || ''}"></div>
                    <div class="form-group"><label>标准课时</label><input type="number" id="tfHours" value="${data.standard_hours || 140}"></div>
                    <div class="form-group"><label>联系方式 *</label><input type="text" id="tfPhone" value="${data.phone || ''}"></div>
                    <div class="form-group"><label>部门 *</label>
                        <select id="tfDept"><option value="D01">英语教研组</option><option value="D02">数学教研组</option><option value="D03">计算机教研室</option><option value="D04">行政教务部</option></select>
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:12px;">
                    <button class="btn btn-primary" id="saveTeacherBtn">💾 保存</button>
                    <button class="btn btn-outline" id="cancelTeacherBtn">取消</button>
                </div>
                <div id="teacherFormResult" style="margin-top:10px;"></div>
            </div>
        `;
        
        document.getElementById('closeTeacherForm').addEventListener('click', () => container.style.display = 'none');
        document.getElementById('cancelTeacherBtn').addEventListener('click', () => container.style.display = 'none');
        
        document.getElementById('saveTeacherBtn').addEventListener('click', async function() {
            const id = document.getElementById('tfId').value.trim();
            const name = document.getElementById('tfName').value.trim();
            const gender = document.getElementById('tfGender').value;
            const hire_date = document.getElementById('tfHire').value;
            const position = document.getElementById('tfPosition').value.trim();
            const standard_hours = parseInt(document.getElementById('tfHours').value) || 140;
            const phone = document.getElementById('tfPhone').value.trim();
            const dept_id = document.getElementById('tfDept').value;
            const resultEl = document.getElementById('teacherFormResult');
            
            if (!id || !name || !hire_date || !position || !phone) {
                resultEl.innerHTML = '<span style="color:#e53e3e;">❌ 请填写所有必填字段</span>';
                return;
            }
            
            this.disabled = true; this.textContent = '保存中...';
            try {
                if (editId) {
                    await API.teachers.update(id, { name, gender, hire_date, position, standard_hours, phone, dept_id, is_active: 1 });
                } else {
                    await API.teachers.create({ teacher_id: id, name, gender, hire_date, position, standard_hours, phone, dept_id });
                }
                resultEl.innerHTML = '<span style="color:#38a169;">✅ 保存成功</span>';
                container.style.display = 'none';
                await loadTeachers();
            } catch (err) {
                resultEl.innerHTML = `<span style="color:#e53e3e;">❌ ${err.message}</span>`;
            } finally {
                this.disabled = false; this.textContent = '💾 保存';
            }
        });
    }
    
    // ==================== 课程管理 ====================
    async function renderCourses() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header"><h1>📖 课程管理</h1><button class="btn btn-primary" id="addCourseBtn">➕ 添加课程</button></div>
            <div class="card"><div class="card-header"><h3>课程列表</h3></div><div id="courseTable"><p>加载中...</p></div></div>
            <div id="courseFormContainer" style="display:none;"></div>
        `;
        await loadCourses();
        document.getElementById('addCourseBtn').addEventListener('click', () => showCourseForm());
    }
    
    async function loadCourses() {
        try {
            const courses = await API.courses.list();
            const tableHtml = courses.length === 0 ? '<p>暂无课程</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>编号</th><th>课程名</th><th>单节课时</th><th>类型</th><th>操作</th></tr></thead>
                    <tbody>${courses.map(c => `
                        <tr>
                            <td>${c.course_id}</td>
                            <td>${c.course_name}</td>
                            <td>${c.hours_per_session}</td>
                            <td>${c.course_type}</td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="editCourse('${c.course_id}')">编辑</button>
                                <button class="btn btn-danger btn-sm" onclick="deleteCourse('${c.course_id}')">删除</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('courseTable').innerHTML = tableHtml;
            window.editCourse = (id) => showCourseForm(id);
            window.deleteCourse = async (id) => {
                if (confirm(`确定删除课程 ${id} 吗？`)) {
                    try { await API.courses.delete(id); await loadCourses(); } 
                    catch (err) { alert('删除失败: ' + err.message); }
                }
            };
        } catch (err) {
            document.getElementById('courseTable').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    function showCourseForm(editId = null) {
        const container = document.getElementById('courseFormContainer');
        if (container.style.display === 'block' && !editId) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        // 简化：快速表单
        container.innerHTML = `
            <div class="card" style="border:2px solid #4a8db7;">
                <div class="card-header"><h3>${editId ? '✏️ 编辑课程' : '➕ 添加课程'}</h3>
                    <button class="btn btn-outline btn-sm" id="closeCourseForm">✕</button>
                </div>
                <div class="form-grid">
                    <div class="form-group"><label>编号 *</label><input type="text" id="cfId" value="${editId || ''}" ${editId ? 'readonly' : ''}></div>
                    <div class="form-group"><label>课程名 *</label><input type="text" id="cfName"></div>
                    <div class="form-group"><label>单节课时</label><input type="number" id="cfHours" value="2" step="0.5"></div>
                    <div class="form-group"><label>类型 *</label>
                        <select id="cfType"><option value="必修">必修</option><option value="选修">选修</option><option value="实训课">实训课</option><option value="公共课">公共课</option></select>
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:12px;">
                    <button class="btn btn-primary" id="saveCourseBtn">💾 保存</button>
                    <button class="btn btn-outline" id="cancelCourseBtn">取消</button>
                </div>
                <div id="courseFormResult" style="margin-top:10px;"></div>
            </div>
        `;
        if (editId) {
            API.courses.get(editId).then(d => {
                document.getElementById('cfName').value = d.course_name || '';
                document.getElementById('cfHours').value = d.hours_per_session || 2;
                document.getElementById('cfType').value = d.course_type || '必修';
            }).catch(() => {});
        }
        document.getElementById('closeCourseForm').addEventListener('click', () => container.style.display = 'none');
        document.getElementById('cancelCourseBtn').addEventListener('click', () => container.style.display = 'none');
        document.getElementById('saveCourseBtn').addEventListener('click', async function() {
            const id = document.getElementById('cfId').value.trim();
            const name = document.getElementById('cfName').value.trim();
            const hours = parseFloat(document.getElementById('cfHours').value) || 2;
            const type = document.getElementById('cfType').value;
            const resultEl = document.getElementById('courseFormResult');
            if (!id || !name) { resultEl.innerHTML = '<span style="color:#e53e3e;">❌ 请填写编号和名称</span>'; return; }
            this.disabled = true; this.textContent = '保存中...';
            try {
                if (editId) await API.courses.update(id, { course_name: name, hours_per_session: hours, course_type: type });
                else await API.courses.create({ course_id: id, course_name: name, hours_per_session: hours, course_type: type });
                resultEl.innerHTML = '<span style="color:#38a169;">✅ 保存成功</span>';
                container.style.display = 'none';
                await loadCourses();
            } catch (err) {
                resultEl.innerHTML = `<span style="color:#e53e3e;">❌ ${err.message}</span>`;
            } finally {
                this.disabled = false; this.textContent = '💾 保存';
            }
        });
    }
    
    // ==================== 排班管理 ====================
    async function renderSchedules() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header"><h1>📅 排班管理</h1><button class="btn btn-primary" id="addScheduleBtn">➕ 添加排班</button></div>
            <div class="card"><div class="card-header"><h3>排班列表</h3></div><div id="scheduleTable"><p>加载中...</p></div></div>
            <div id="scheduleFormContainer" style="display:none;"></div>
        `;
        await loadSchedules();
        document.getElementById('addScheduleBtn').addEventListener('click', () => showScheduleForm());
    }
    
    async function loadSchedules() {
        try {
            const schedules = await API.schedules.list();
            const tableHtml = schedules.length === 0 ? '<p>暂无排班</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>编号</th><th>教师</th><th>课程</th><th>上课时间</th><th>教室</th><th>操作</th></tr></thead>
                    <tbody>${schedules.map(s => `
                        <tr>
                            <td>${s.schedule_id}</td>
                            <td>${s.teacher_name || s.teacher_id}</td>
                            <td>${s.course_name || s.course_id}</td>
                            <td>${s.class_time}</td>
                            <td>${s.classroom}</td>
                            <td>
                                <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${s.schedule_id}')">删除</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('scheduleTable').innerHTML = tableHtml;
            window.deleteSchedule = async (id) => {
                if (confirm(`确定删除排班 ${id} 吗？`)) {
                    try { await API.schedules.delete(id); await loadSchedules(); } 
                    catch (err) { alert('删除失败: ' + err.message); }
                }
            };
        } catch (err) {
            document.getElementById('scheduleTable').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    function showScheduleForm() {
        const container = document.getElementById('scheduleFormContainer');
        if (container.style.display === 'block') { container.style.display = 'none'; return; }
        container.style.display = 'block';
        container.innerHTML = `
            <div class="card" style="border:2px solid #4a8db7;">
                <div class="card-header"><h3>➕ 添加排班</h3><button class="btn btn-outline btn-sm" id="closeScheduleForm">✕</button></div>
                <div class="form-grid">
                    <div class="form-group"><label>排班编号 *</label><input type="text" id="sfId" placeholder="如 P006"></div>
                    <div class="form-group"><label>教师 *</label><input type="text" id="sfTeacher" placeholder="T001"></div>
                    <div class="form-group"><label>课程 *</label><input type="text" id="sfCourse" placeholder="C001"></div>
                    <div class="form-group"><label>上课时间 *</label><input type="text" id="sfTime" placeholder="周一08:00-09:40"></div>
                    <div class="form-group"><label>教室 *</label><input type="text" id="sfRoom" placeholder="101教室"></div>
                    <div class="form-group"><label>周次 *</label><input type="text" id="sfWeeks" placeholder="1-18周"></div>
                </div>
                <div style="display:flex;gap:12px;margin-top:12px;">
                    <button class="btn btn-primary" id="saveScheduleBtn">💾 保存</button>
                    <button class="btn btn-outline" id="cancelScheduleBtn">取消</button>
                </div>
                <div id="scheduleFormResult" style="margin-top:10px;"></div>
            </div>
        `;
        document.getElementById('closeScheduleForm').addEventListener('click', () => container.style.display = 'none');
        document.getElementById('cancelScheduleBtn').addEventListener('click', () => container.style.display = 'none');
        document.getElementById('saveScheduleBtn').addEventListener('click', async function() {
            const id = document.getElementById('sfId').value.trim();
            const teacher = document.getElementById('sfTeacher').value.trim();
            const course = document.getElementById('sfCourse').value.trim();
            const time = document.getElementById('sfTime').value.trim();
            const room = document.getElementById('sfRoom').value.trim();
            const weeks = document.getElementById('sfWeeks').value.trim();
            const resultEl = document.getElementById('scheduleFormResult');
            if (!id || !teacher || !course || !time || !room || !weeks) {
                resultEl.innerHTML = '<span style="color:#e53e3e;">❌ 请填写所有字段</span>'; return;
            }
            this.disabled = true; this.textContent = '保存中...';
            try {
                await API.schedules.create({ schedule_id: id, teacher_id: teacher, course_id: course, class_time: time, classroom: room, weeks });
                resultEl.innerHTML = '<span style="color:#38a169;">✅ 排班添加成功</span>';
                container.style.display = 'none';
                await loadSchedules();
            } catch (err) {
                resultEl.innerHTML = `<span style="color:#e53e3e;">❌ ${err.message}</span>`;
            } finally {
                this.disabled = false; this.textContent = '💾 保存';
            }
        });
    }
    
    // ==================== 考勤管理 ====================
    async function renderAttendance() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header"><h1>📋 考勤管理</h1></div>
            <div class="card"><div class="card-header"><h3>所有考勤记录</h3></div><div id="attendanceTable"><p>加载中...</p></div></div>
        `;
        try {
            const records = await API.attendance.list();
            const tableHtml = records.length === 0 ? '<p>暂无记录</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>教师</th><th>日期</th><th>上班</th><th>下班</th><th>状态</th><th>课时</th><th>操作</th></tr></thead>
                    <tbody>${records.slice(0, 50).map(r => `
                        <tr>
                            <td>${r.teacher_name || r.teacher_id}</td>
                            <td>${r.check_date}</td>
                            <td>${r.check_in || '-'}</td>
                            <td>${r.check_out || '-'}</td>
                            <td><span class="status-badge ${r.status}">${r.status}</span></td>
                            <td>${r.actual_hours || 0}</td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteAttendance('${r.record_id}')">删除</button></td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('attendanceTable').innerHTML = tableHtml;
            window.deleteAttendance = async (id) => {
                if (confirm(`确定删除考勤记录 ${id} 吗？`)) {
                    try { await API.attendance.delete(id); await renderAttendance(); } 
                    catch (err) { alert('删除失败: ' + err.message); }
                }
            };
        } catch (err) {
            document.getElementById('attendanceTable').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    // ==================== 请假审核 ====================
    async function renderLeaves() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="page-header"><h1>📝 请假审核</h1></div>
            <div class="card"><div class="card-header"><h3>所有请假申请</h3></div><div id="leaveTable"><p>加载中...</p></div></div>
        `;
        try {
            const leaves = await API.leaves.list();
            const tableHtml = leaves.length === 0 ? '<p>暂无请假</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>编号</th><th>教师</th><th>类型</th><th>起止时间</th><th>事由</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>${leaves.map(l => `
                        <tr>
                            <td>${l.leave_id}</td>
                            <td>${l.teacher_name || l.teacher_id}</td>
                            <td>${l.leave_type}</td>
                            <td>${l.start_date} ~ ${l.end_date}</td>
                            <td>${l.reason}</td>
                            <td><span class="status-badge ${l.status === '已通过' ? 'approved' : l.status === '已驳回' ? 'rejected' : 'pending'}">${l.status}</span></td>
                            <td>
                                ${l.status === '待审核' ? `
                                    <button class="btn btn-success btn-sm" onclick="approveLeave('${l.leave_id}','已通过')">通过</button>
                                    <button class="btn btn-danger btn-sm" onclick="approveLeave('${l.leave_id}','已驳回')">驳回</button>
                                ` : '-'}
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('leaveTable').innerHTML = tableHtml;
            window.approveLeave = async (id, status) => {
                try {
                    await API.leaves.approve(id, status, '教务员');
                    await renderLeaves();
                } catch (err) { alert('审核失败: ' + err.message); }
            };
        } catch (err) {
            document.getElementById('leaveTable').innerHTML = `<p style="color:#e53e3e;">加载失败</p>`;
        }
    }
    
    // ==================== 报表统计 ====================
    async function renderReports() {
        const container = document.getElementById('mainContent');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        container.innerHTML = `
            <div class="page-header"><h1>📊 报表统计</h1></div>
            <div class="stats-grid" id="reportStats"></div>
            <div class="card"><div class="card-header"><h3>📋 部门月度统计 (${year}年${month}月)</h3></div><div id="reportTable"><p>加载中...</p></div></div>
        `;
        try {
            const summary = await API.reports.summary(year, month);
            const statsHtml = `
                <div class="stat-card"><div class="number blue">${summary.total.teacher_count || 0}</div><div class="label">教师总数</div></div>
                <div class="stat-card"><div class="number green">${summary.total.normal_count || 0}</div><div class="label">正常出勤</div></div>
                <div class="stat-card"><div class="number orange">${summary.total.late_count || 0}</div><div class="label">迟到</div></div>
                <div class="stat-card"><div class="number red">${summary.total.absent_count || 0}</div><div class="label">旷工</div></div>
                <div class="stat-card"><div class="number purple">${summary.total.total_hours || 0}</div><div class="label">总课时</div></div>
            `;
            document.getElementById('reportStats').innerHTML = statsHtml;
            
            const depts = summary.departments || [];
            const tableHtml = depts.length === 0 ? '<p>暂无数据</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>部门</th><th>教师数</th><th>正常</th><th>迟到</th><th>旷工</th><th>总课时</th></tr></thead>
                    <tbody>${depts.map(d => `
                        <tr>
                            <td><strong>${d.dept_name}</strong></td>
                            <td>${d.teacher_count || 0}</td>
                            <td>${d.normal_count || 0}</td>
                            <td>${d.late_count || 0}</td>
                            <td>${d.absent_count || 0}</td>
                            <td>${d.total_hours || 0}</td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('reportTable').innerHTML = tableHtml;
        } catch (err) {
            document.getElementById('reportTable').innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
        }
    }
});