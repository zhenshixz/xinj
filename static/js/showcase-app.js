/**
 * 星影共创 - Vue 应用
 *
 * 浏览共享作品、查看详情、脚本复刻跳转
 */
const { createApp, ref, onMounted } = Vue;

const app = createApp({
    setup() {
        // ── Auth ──
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('mock login');
            return {};
        }
        const authHeaders = {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
        };

        const userCredits = ref(0);
        const onUserLoaded = (info) => {
            userCredits.value = info.credits || 0;
        };

        // ── Toast ──
        const toast = ref({ show: false, message: '', type: 'success' });
        const showToast = (msg, type = 'success') => {
            toast.value = { show: true, message: msg, type };
            setTimeout(() => { toast.value.show = false; }, 3000);
        };

        // ── 列表数据 ──
        const works = ref([]);
        const loading = ref(false);
        const hasMore = ref(false);
        const currentPage = ref(1);
        const pageSize = 12;

        const loadWorks = async (append = false) => {
            if (loading.value) return;
            loading.value = true;

            try {
                const res = await fetch(
                    `/api/showcase?page=${currentPage.value}&page_size=${pageSize}`,
                    { headers: authHeaders }
                );
                const json = await res.json();

                if (json.code === 401) {
                    localStorage.clear();
                    console.log('mock login');
                    return;
                }

                if (json.code === 200) {
                    if (append) {
                        works.value.push(...json.data);
                    } else {
                        works.value = json.data || [];
                    }
                    hasMore.value = !!json.has_more;
                }
            } catch (e) {
                console.error('加载作品失败', e);
                showToast('加载失败，请稍后重试', 'error');
            } finally {
                loading.value = false;
            }
        };

        const loadMore = () => {
            currentPage.value++;
            loadWorks(true);
        };

        // ── 详情弹窗 ──
        const detailModal = ref({
            show: false,
            data: {},
        });

        const viewDetail = async (work) => {
            // 先用列表数据快速展示（保留所有列表字段作为基底）
            detailModal.value = {
                show: true,
                data: { ...work },
            };

            // 再异步加载完整数据（含 prompt / pro_mode_data）
            try {
                const res = await fetch(
                    `/api/showcase/detail?id=${work.id}`,
                    { headers: authHeaders }
                );
                const json = await res.json();
                if (json.code === 200 && json.data) {
                    // 合并而非替换：保留列表数据作为兜底，用详情数据覆盖
                    detailModal.value.data = { ...work, ...json.data };
                    // 更新列表中的浏览计数
                    const idx = works.value.findIndex(w => w.id === work.id);
                    if (idx >= 0) {
                        works.value[idx].views_count = json.data.views_count;
                    }
                }
            } catch (e) {
                console.error('加载详情失败', e);
                showToast('加载详情失败，请稍后重试', 'error');
            }
        };

        // ── 脚本复刻跳转 ──
        const replicateScript = async () => {
            const data = detailModal.value.data;
            if (!data) {
                showToast('作品数据加载失败', 'error');
                return;
            }

            let proModeData = data.pro_mode_data;

            // 如果 pro_mode_data 还没加载（列表 API 不返回），则从详情 API 按需获取
            if (!proModeData && data.id) {
                try {
                    showToast('正在加载脚本数据...', 'success');
                    const res = await fetch(
                        `/api/showcase/detail?id=${data.id}`,
                        { headers: authHeaders }
                    );
                    const json = await res.json();
                    if (json.code === 200 && json.data && json.data.pro_mode_data) {
                        proModeData = json.data.pro_mode_data;
                        // 同步更新弹窗数据
                        detailModal.value.data = { ...data, ...json.data };
                    }
                } catch (e) {
                    console.error('获取脚本数据失败', e);
                }
            }

            if (!proModeData) {
                showToast('该作品暂无可复刻的脚本数据', 'error');
                return;
            }

            // 存入 sessionStorage，跳转到 video.html 后自动回填
            const replicateData = {
                ...proModeData,
                // 清空参考图片，让用户上传自己的产品图
                ref_image_urls: [],
                _from_showcase: true,
                _showcase_title: data.title || '',
            };

            sessionStorage.setItem('showcase_replicate', JSON.stringify(replicateData));

            // 跳转到视频生成页
            window.location.href = './video.html';
        };

        // ── 初始化 ──
        onMounted(() => {
            loadWorks();
        });

        return {
            userCredits, onUserLoaded,
            toast, showToast,
            works, loading, hasMore,
            loadMore,
            detailModal, viewDetail,
            replicateScript,
        };
    }
});

app.component('app-header', AppHeaderComponent);
app.mount('#app');
