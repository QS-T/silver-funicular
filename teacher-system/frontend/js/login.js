document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');
    
    // 如果已登录，跳转到对应页面
    const user = getUser();
    const token = getToken();
    if (user && token) {
        redirectByRole(user.role);
        return;
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            errorEl.textContent = '请输入账号和密码';
            return;
        }
        
        errorEl.textContent = '';
        const btn = form.querySelector('.btn-login');
        btn.disabled = true;
        btn.textContent = '登录中...';
        
        try {
            const result = await API.auth.login(username, password);
            setToken(result.token);
            setUser(result.user);
            redirectByRole(result.user.role);
        } catch (err) {
            errorEl.textContent = err.message || '登录失败，请检查账号和密码';
            btn.disabled = false;
            btn.textContent = '登 录';
        }
    });
});

function redirectByRole(role) {
    const roleMap = {
        '超级管理员': 'admin.html',
        '教务员': 'admin.html',
        '校领导': 'leader.html'
    };
    const page = roleMap[role] || 'teacher.html';
    window.location.href = page;
}