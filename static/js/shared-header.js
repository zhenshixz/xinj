/**
 * 公共头部组件 (Vue 3)
 *
 * 用法:
 *   1. 在页面 <head> 中引入: <script src="/static/shared-header.js?v=xxx"></script>
 *   2. 在 createApp 前注册组件: app.component('app-header', AppHeaderComponent)
 *   3. 在模板中使用:
 *       <app-header
 *         active-page="image"
 *         :user-credits="userCredits"
 *         @credits-updated="val => userCredits = val"
 *       />
 *
 *   Props:
 *     - activePage: 'image' | 'video' | 'assets' — 高亮当前导航 tab
 *     - userCredits: Number — 由父组件同步积分余额（生成消耗后更新）
 *
 *   Events:
 *     - credits-updated(newVal): 当组件内刷新了用户积分时通知父组件
 *     - user-loaded({ credits, username, avatar, role }): 用户信息加载完成
 *     - site-loaded({ siteName, siteLogo }): 站点配置加载完成
 *
 * 组件自行管理: 站点配置、用户信息、头像上传、积分明细弹窗、退出登录
 * 不再需要各页面重复实现这些逻辑
 */

const AppHeaderComponent = {
    name: 'AppHeader',
    props: {
        activePage: { type: String, default: '' },
        userCredits: { type: Number, default: 0 },
    },
    emits: ['credits-updated', 'user-loaded', 'site-loaded'],

    setup(props, { emit }) {
        const { ref, computed, onMounted } = Vue;

        // Auth
        const token = localStorage.getItem('token');
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};

        // Site config
        const siteName = ref(storedUser._siteName || '');
        const siteLogo = ref(storedUser._siteLogo || '');

        // User state
        const userName = ref(storedUser.username || '');
        const userAvatar = ref(storedUser.avatar || '');
        const localCredits = ref(storedUser.credits || 0);
        const userRole = ref(storedUser.role || 0);
        const userInitial = computed(() => userName.value ? userName.value[0].toUpperCase() : 'U');

        // 显示的积分：优先使用父组件传入的实时值
        const displayCredits = computed(() => props.userCredits || localCredits.value);

        // Avatar upload
        const avatarInput = ref(null);
        const handleAvatarUpload = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('avatar', file);
            try {
                const res = await fetch('/api/user/avatar', { method: 'POST', body: fd, headers: authHeaders });
                const json = await res.json();
                if (json.code === 200) {
                    userAvatar.value = json.data.url;
                    // 简单的 toast 提示（利用 document 事件通知父组件）
                    document.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '头像更新成功', type: 'success' } }));
                } else {
                    document.dispatchEvent(new CustomEvent('app-toast', { detail: { message: json.msg || '上传失败', type: 'error' } }));
                }
            } catch {
                document.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '上传失败', type: 'error' } }));
            }
            finally { e.target.value = ''; }
        };

        // Credit logs modal
        const showCreditModal = ref(false);
        const creditLogList = ref([]);
        const loadCreditLogs = async () => {
            showCreditModal.value = true;
            try {
                const res = await fetch('/api/user/credits', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 200) {
                    creditLogList.value = json.data.list || json.data || [];
                }
            } catch { /* 静默失败 */ }
        };

        const formatTime = (ts) => {
            if (!ts) return '';
            let d;
            if (typeof ts === 'string' && ts.includes('-')) d = new Date(ts);
            else d = new Date(Number(ts) * 1000);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        // Logout
        const logout = () => { localStorage.clear(); window.location.href = '/pages/login.html'; };

        // Load site config
        const loadSiteConfig = async () => {
            try {
                const res = await fetch('/api/site/config');
                const json = await res.json();
                if (json.code === 200) {
                    siteName.value = json.data.site_name || '';
                    siteLogo.value = json.data.site_logo || '';
                    emit('site-loaded', { siteName: siteName.value, siteLogo: siteLogo.value });
                }
            } catch { /* 静默失败 */ }
        };

        // Refresh user info
        const refreshUser = async () => {
            try {
                const res = await fetch('/api/user/info', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 200) {
                    localCredits.value = json.data.credits;
                    userName.value = json.data.username;
                    userAvatar.value = json.data.avatar || '';
                    userRole.value = json.data.role || 0;
                    emit('credits-updated', localCredits.value);
                    emit('user-loaded', {
                        credits: localCredits.value,
                        username: userName.value,
                        avatar: userAvatar.value,
                        role: userRole.value,
                    });
                }
            } catch { /* 静默失败 */ }
        };

        onMounted(() => {
            loadSiteConfig();
            refreshUser();
        });

        return {
            siteName, siteLogo,
            userName, userAvatar, userRole, userInitial,
            displayCredits,
            avatarInput, handleAvatarUpload,
            showCreditModal, creditLogList, loadCreditLogs, formatTime,
            logout,
        };
    },

    template: `
    <header class="app-header">
        <a class="brand-block" href="/index.html">
            <img v-if="siteLogo" :src="siteLogo" class="brand-logo" alt="Logo">
            <div class="brand-info">
                <span class="brand-name">{{ siteName }}</span>
                <span class="brand-subtitle" style="color: var(--primary);">跨境多模态AI工具箱</span>
            </div>
        </a>
        <div class="header-left">
            <nav class="nav-tabs">
                <a :class="['nav-tab', activePage === 'image' ? 'active' : '']" href="/pages/image.html">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    图片生成
                </a>
                <a :class="['nav-tab', activePage === 'video' ? 'active' : '']" href="/pages/video.html">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    视频生成
                </a>
            </nav>
        </div>

        <div class="header-right">
            <div class="credits-badge">
                <span style="font-size: 14px; margin-right: 2px;">⚡</span>
                <span>{{ displayCredits }}</span>
            </div>

            <!-- User Avatar Dropdown -->
            <div class="user-menu">
                <div class="user-avatar-btn">
                    <img v-if="userAvatar" :src="userAvatar" alt="">
                    <span v-else>{{ userInitial }}</span>
                </div>
                <div class="user-dropdown">
                    <div class="dropdown-header">
                        <div class="dropdown-avatar">
                            <img v-if="userAvatar" :src="userAvatar" alt="">
                            <span v-else>{{ userInitial }}</span>
                        </div>
                        <div class="dropdown-user-info">
                            <div class="dropdown-username">{{ userName }}</div>
                            <div class="dropdown-credits">积分余额：{{ displayCredits }}</div>
                        </div>
                    </div>
                    <div class="dropdown-menu">
                        <button class="dropdown-item" @click="avatarInput.click()">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            修改头像
                        </button>
                        <input type="file" ref="avatarInput" @change="handleAvatarUpload" accept="image/*" style="display:none">
                        <button class="dropdown-item" @click="loadCreditLogs">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            积分明细
                        </button>
                        <a href="/pages/assets.html" class="dropdown-item" style="text-decoration:none">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            我的资产
                        </a>
                        <a v-if="userRole===1" href="/pages/admin.html" class="dropdown-item" style="text-decoration:none">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            管理后台
                        </a>
                        <div class="dropdown-divider"></div>
                        <button class="dropdown-item danger" @click="logout">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            退出登录
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- 积分明细弹窗 -->
    <div v-if="showCreditModal" class="credit-modal-overlay" @click.self="showCreditModal = false">
        <div class="credit-modal">
            <div class="credit-modal-header">
                <h3>积分明细</h3>
                <button class="credit-modal-close" @click="showCreditModal = false">&times;</button>
            </div>
            <div class="credit-modal-body">
                <div v-if="creditLogList.length === 0"
                    style="text-align:center;padding:32px;color:var(--text-muted,#8e8e93);font-size:14px">暂无积分记录</div>
                <div v-for="log in creditLogList" :key="log.id" class="credit-log-item">
                    <div class="credit-log-left">
                        <div class="credit-log-remark">{{ log.remark || log.type_text || log.description }}</div>
                        <div class="credit-log-time">{{ formatTime(log.create_time) }}</div>
                    </div>
                    <div :class="['credit-log-amount', log.amount > 0 ? 'positive' : 'negative']">
                        {{ log.amount > 0 ? '+' : '' }}{{ log.amount }}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `
};
