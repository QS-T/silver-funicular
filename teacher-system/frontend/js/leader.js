// ==================== 领导端主逻辑 ====================
document.addEventListener('DOMContentLoaded', function() {
    const user = getUser();
    if (!user || !getToken()) {
        window.location.href = 'index.html';
        return;
    }
    if (!['超级管理员', '校领导'].includes(user.role)) {
        alert('您没有校领导权限');
        window.location.href = 'teacher.html';
        return;
    }
    
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = user.role;
    
    const routes = {
        summary: renderSummary,
        department: renderDepartment,
        absent: renderAbsent
    };
    
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (routes[page]) {
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
    
    renderSummary();
    
    // ==================== 全校汇总 ====================
    async function renderSummary() {
        const container = document.getElementById('mainContent');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        container.innerHTML = `
            <div class="page-header"><h1>📊 全校考勤汇总</h1>
                <div style="display:flex;gap:10px;align-items:center;">
                    <input type="month" id="summaryMonth" value="${year}-${String(month).padStart(2,'0')}">
                    <button class="btn btn-primary btn-sm" id="summaryFilterBtn">查询</button>
                </div>
            </div>
            <div class="stats-grid" id="summaryStats"></div>
            <div class="card"><div class="card-header"><h3>📋 各部门统计</h3></div><div id="summaryTable"><p>加载中...</p></div></div>
        `;
        
        document.getElementById('summaryFilterBtn').addEventListener('click', loadSummary);
        await loadSummary();
    }
    
    async function loadSummary() {
        const monthVal = document.getElementById('summaryMonth').value;
        if (!monthVal) return;
        const [year, month] = monthVal.split('-').map(Number);
        try {
            const data = await API.reports.summary(year, month);
            const statsHtml = `
                <div class="stat-card"><div class="number blue">${data.total.teacher_count || 0}</div><div class="label">教师总数</div></div>
                <div class="stat-card"><div class="number green">${data.total.normal_count || 0}</div><div class="label">正常出勤</div></div>
                <div class="stat-card"><div class="number orange">${data.total.late_count || 0}</div><div class="label">迟到</div></div>
                <div class="stat-card"><div class="number red">${data.total.absent_count || 0}</div><div class="label">旷工</div></div>
                <div class="stat-card"><div class="number purple">${data.total.total_hours || 0}</div><div class="label">总课时</div></div>
            `;
            document.getElementById('summaryStats').innerHTML = statsHtml;
            
            const depts = data.departments || [];
            const tableHtml = depts.length === 0 ? '<p>暂无数据</p>' :
                `<div class="table-responsive"><table>
                    <thead><tr><th>部门</th><th>教师数</th><th>正常</th><th>迟到</th><th>旷工</th><th>请假</th><th>总课时</th></tr></thead>
                    <tbody>${depts.map(d => `
                        <tr>
                            <td><strong>${d.dept_name}</strong></td>
                            <td>${d.teacher_count || 0}</td>
                            <td>${d.normal_count || 0}</td>
                            <td>${d.late_count || 0}</td>
                            <td>${d.absent_count || 0}</td>
                            <td>${d.leave_count || 0}</td>
                            <td>${d.total_hours || 0}</td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
            document.getElementById('summaryTable').innerHTML = tableHtml;
        } catch (err) {
            document.getElementById('summaryTable').innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
        }
    }
    
    // ==================== 部门报表 ====================
    async function renderDepartment() {
        const container = document.getElementById('mainContent');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        container.innerHTML = `
            <div class="page-header"><h1>🏢 部门报表</h1></div>
            <div class="card">
                <div class="form-grid" style="grid-template-columns: repeat(4, 1fr);">
                    <div class="form-group"><label>部门</label>
                        <select id="deptSelect">
                            <option value="D01">英语教研组</option>
                            <option value="D02">数学教研组</option>
                            <option value="D03">计算机教研室</option>
                            <option value="D04">行政教务部</option>
                        </select>
                    </div>
                    <div class="form-group"><label>年份</label><input type="number" id="deptYear" value="${year}"></div>
                    <div class="form-group"><label>月份</label><input type="number" id="deptMonth" value="${month}" min="1" max="12"></div>
                    <div style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="deptReportBtn">📊 生成报表</button></div>
                </div>
            </div>
            <div class="card"><div class="card-header"><h3>📋 部门考勤明细</h3></div><div id="deptReportTable"><p>请选择条件查询</p></div></div>
        `;
        
        document.getElementById('deptReportBtn').addEventListener('click', async function() {
            const deptId = document.getElementById('deptSelect').value;
            const year = parseInt(document.getElementById('deptYear').value) || new Date().getFullYear();
            const month = parseInt(document.getElementById('deptMonth').value) || new Date().getMonth() + 1;
            const tableEl = document.getElementById('deptReportTable');
            tableEl.innerHTML = '<p>加载中...</p>';
            try {
                const data = await API.reports.department(deptId, year, month);
                const tableHtml = data.length === 0 ? '<p>暂无数据</p>' :
                    `<div class="table-responsive"><table>
                        <thead><tr><th>工号</th><th>姓名</th><th>岗位</th><th>正常</th><th>迟到</th><th>旷工</th><th>请假</th><th>总课时</th><th>标准课时</th><th>差异</th></tr></thead>
                        <tbody>${data.map(r => `
                            <tr>
                                <td>${r.teacher_id}</td>
                                <td>${r.name}</td>
                                <td>${r.position}</td>
                                <td>${r.normal_count || 0}</td>
                                <td>${r.late_count || 0}</td>
                                <td>${r.absent_count || 0}</td>
                                <td>${r.leave_count || 0}</td>
                                <td>${r.total_teaching_hours || 0}</td>
                                <td>${r.standard_hours || 0}</td>
                                <td style="color:${(r.hours_diff||0) >= 0 ? '#38a169' : '#e53e3e'}">${r.hours_diff || 0}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>`;
                tableEl.innerHTML = tableHtml;
            } catch (err) {
                tableEl.innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
            }
        });
    }
    
    // ==================== 缺勤预警 ====================
    async function renderAbsent() {
        const container = document.getElementById('mainContent');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        container.innerHTML = `
            <div class="page-header"><h1>⚠️ 缺勤预警</h1></div>
            <div class="card">
                <div class="form-grid" style="grid-template-columns: repeat(4, 1fr);">
                    <div class="form-group"><label>年份</label><input type="number" id="absentYear" value="${year}"></div>
                    <div class="form-group"><label>月份</label><input type="number" id="absentMonth" value="${month}" min="1" max="12"></div>
                    <div class="form-group"><label>缺勤阈值(天)</label><input type="number" id="absentThreshold" value="2" min="1"></div>
                    <div style="display:flex;align-items:flex-end;"><button class="btn btn-danger" id="absentBtn">🔍 查询缺勤教师</button></div>
                </div>
            </div>
            <div class="card"><div class="card-header"><h3>📋 缺勤教师列表</h3></div><div id="absentTable"><p>请选择条件查询</p></div></div>
        `;
        
        document.getElementById('absentBtn').addEventListener('click', async function() {
            const year = parseInt(document.getElementById('absentYear').value) || new Date().getFullYear();
            const month = parseInt(document.getElementById('absentMonth').value) || new Date().getMonth() + 1;
            const threshold = parseInt(document.getElementById('absentThreshold').value) || 2;
            const tableEl = document.getElementById('absentTable');
            tableEl.innerHTML = '<p>加载中...</p>';
            try {
                const data = await API.reports.absent(year, month, threshold);
                const tableHtml = data.length === 0 ? '<p style="color:#38a169;">✅ 本月无缺勤教师</p>' :
                    `<div class="table-responsive"><table>
                        <thead><tr><th>工号</th><th>姓名</th><th>部门</th><th>缺勤总天数</th><th>旷工</th><th>迟到</th><th>早退</th></tr></thead>
                        <tbody>${data.map(r => `
                            <tr style="background:${r.absent_days >= 5 ? '#fff5f5' : ''}">
                                <td>${r.teacher_id}</td>
                                <td><strong>${r.name}</strong></td>
                                <td>${r.dept_name || '-'}</td>
                                <td style="color:#e53e3e;font-weight:600;">${r.absent_days}</td>
                                <td>${r.absent_count || 0}</td>
                                <td>${r.late_count || 0}</td>
                                <td>${r.early_count || 0}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>`;
                tableEl.innerHTML = tableHtml;
            } catch (err) {
                tableEl.innerHTML = `<p style="color:#e53e3e;">加载失败: ${err.message}</p>`;
            }
        });
    }
});