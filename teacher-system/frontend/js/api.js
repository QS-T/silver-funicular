// ==================== API 基础配置 ====================
//const API_BASE = 'http://localhost:3000/api';
const API_BASE = 'https://262cb1de.r12.vip.cpolar.cn/api';
// 获取存储的token
function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('teacherToken');
//return localStorage.getItem('token');
}

// 设置token
function setToken(token) {
    localStorage.setItem('token', token);
}

// 清除token
function clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('user');
    localStorage.removeItem('teacherUser');
}
// 获取用户信息
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// 设置用户信息
function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

// 通用请求函数
async function request(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                // 令牌失效，跳转登录
                clearToken();
                if (window.location.pathname !== '/index.html' && 
                    !window.location.pathname.endsWith('index.html')) {
                    window.location.href = '/index.html';
                }
            }
            throw new Error(data.error || '请求失败');
        }
        
        return data;
    } catch (err) {
        console.error('API请求错误:', err);
        throw err;
    }
}

// ==================== API 方法 ====================
const API = {
    // 认证
    auth: {
        login: (username, password) => {
            return request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
        },
        verify: () => {
            return request('/auth/verify');
        }
    },
    
    // 教师管理
    teachers: {
        list: () => request('/teachers'),
        get: (id) => request(`/teachers/${id}`),
        create: (data) => request('/teachers', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id, data) => request(`/teachers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        delete: (id) => request(`/teachers/${id}`, {
            method: 'DELETE'
        })
    },
    
    // 课程管理
    courses: {
        list: () => request('/courses'),
        get: (id) => request(`/courses/${id}`),
        create: (data) => request('/courses', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id, data) => request(`/courses/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        delete: (id) => request(`/courses/${id}`, {
            method: 'DELETE'
        })
    },
    
    // 排班管理
    schedules: {
        list: () => request('/schedules'),
        getByTeacher: (teacherId) => request(`/schedules/teacher/${teacherId}`),
        create: (data) => request('/schedules', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id, data) => request(`/schedules/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        delete: (id) => request(`/schedules/${id}`, {
            method: 'DELETE'
        })
    },
    
    // 考勤打卡
    attendance: {
        list: () => request('/attendance'),
        getByTeacher: (teacherId, params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/attendance/teacher/${teacherId}?${qs}`);
        },
        clock: (data) => request('/attendance/clock', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (recordId, data) => request(`/attendance/${recordId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        delete: (recordId) => request(`/attendance/${recordId}`, {
            method: 'DELETE'
        })
    },
    
    // 请假管理
    leaves: {
        list: () => request('/leaves'),
        getByTeacher: (teacherId) => request(`/leaves/teacher/${teacherId}`),
        create: (data) => request('/leaves', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        approve: (leaveId, status, approver) => request(`/leaves/${leaveId}/approve`, {
            method: 'PUT',
            body: JSON.stringify({ status, approver })
        }),
        delete: (leaveId) => request(`/leaves/${leaveId}`, {
            method: 'DELETE'
        })
    },
    
    // 报表统计
    reports: {
        monthly: (year, month) => request(`/reports/monthly/${year}/${month}`),
        department: (deptId, year, month) => request(`/reports/department/${deptId}/${year}/${month}`),
        teacherSummary: (teacherId, year, month) => request(`/reports/teacher/${teacherId}/${year}/${month}`),
        summary: (year, month) => request(`/reports/summary/${year}/${month}`),
        absent: (year, month, threshold = 2) => request(`/reports/absent/${year}/${month}?threshold=${threshold}`)
    }
};