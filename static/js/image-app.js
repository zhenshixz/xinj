// Image Generation Page - App JavaScript
const { createApp, ref, computed, onMounted, onUnmounted, watch, nextTick } = Vue;

const app = createApp({
    setup() {
        // Auth check
        const token = localStorage.getItem('token');
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (!token) { window.location.href='/pages/login.html'; return {}; }
        const authHeaders = { 'Authorization': 'Bearer ' + token };

        // Site config
        const siteName = ref(storedUser._siteName || '');
        const siteLogo = ref(storedUser._siteLogo || '');

        // User state
        const userName = ref(storedUser.username || '');
        const userAvatar = ref(storedUser.avatar || '');
        const userCredits = ref(storedUser.credits || 0);
        const userRole = ref(storedUser.role || 0);
        const userInitial = computed(() => userName.value ? userName.value[0].toUpperCase() : 'U');

        // Toast
        const toast = ref({ show: false, message: '', type: 'success' });
        const showToast = (msg, type = 'success') => {
            toast.value = { show: true, message: msg, type };
            setTimeout(() => { toast.value.show = false; }, 3500);
        };

        // 监听公共头部组件的 toast 事件
        document.addEventListener('app-toast', (e) => {
            const { message, type } = e.detail;
            showToast(message, type);
        });

        // Models (image only)
        const allModels = ref([]);
        const imageModels = computed(() => allModels.value.filter(m => m.type === 'image'));
        const currentModel = ref('');
        const currentModelObj = computed(() => allModels.value.find(x => x.model_key === currentModel.value));
        const currentModelCost = computed(() => currentModelObj.value ? currentModelObj.value.credits_cost : 0);
        const totalCost = computed(() => currentModelCost.value * imageCount.value);

        // 自定义下拉框的展开/收起状态
        const modelDropOpen = ref(false);
        document.addEventListener('click', () => { modelDropOpen.value = false; });

        // Dynamic image settings (from model capabilities)
        const imageRatio = ref('3:4');
        const imageQuality = ref('2K');
        const imageCount = ref(1);
        const imageRatios = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return caps?.aspect_ratios || ['1:1', '3:4', '4:3', '9:16', '16:9'];
        });
        const imageQualities = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return caps?.image_sizes || ['1K'];
        });
        const maxImageCount = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return Math.min(caps?.max_images || 4, 4);
        });

        // Global flag to prevent resetting settings when doing reEdit
        const isRestoring = ref(false);

        // When model changes, reset settings to first available option
        watch(currentModel, () => {
            if (isRestoring.value) return;
            const caps = currentModelObj.value?.capabilities;
            if (caps) {
                if (caps.aspect_ratios && caps.aspect_ratios.length > 0 && !caps.aspect_ratios.includes(imageRatio.value)) {
                    imageRatio.value = caps.aspect_ratios[0];
                }
                if (caps.image_sizes && caps.image_sizes.length > 0 && !caps.image_sizes.includes(imageQuality.value)) {
                    imageQuality.value = caps.image_sizes[0];
                }
                if (caps.max_images && imageCount.value > Math.min(caps.max_images, 4)) {
                    imageCount.value = 1;
                }
            }
        });

        // Settings popover
        const showSettings = ref(false);
        const settingsLabel = computed(() => `${imageRatio.value} | ${imageCount.value}张`);

        // Upload (multi-image, per-image loading like video page)
        // 使用统一的 refImages 数组: { preview: string, url: string }
        // url 为空字符串表示正在上传中（显示 spinner）
        const fileInput = ref(null);
        const refImages = ref([]);
        const isUploading = ref(false);

        // 兼容层：供模板和生成逻辑使用的计算属性
        const uploadPreviews = computed(() => refImages.value.map(img => img.preview));
        const uploadUrls = computed(() => refImages.value.filter(img => img.url).map(img => img.url));

        // 支持一次选择多张图片批量上传，每张独立上传并显示进度
        const handleFileUpload = async (e) => {
            const selectedFiles = Array.from(e.target.files || []);
            if (selectedFiles.length === 0) return;

            isUploading.value = true;

            // 为每张图先创建本地预览占位（立即显示加载动画）
            // 注意：push 进 ref 数组后，Vue 3 会将对象包裹为响应式代理，
            // 后续赋值必须通过数组中的代理引用，否则不会触发 UI 更新
            const uploadTasks = selectedFiles.map(file => {
                const preview = URL.createObjectURL(file);
                refImages.value.push({ preview, url: '' });
                const proxyRef = refImages.value[refImages.value.length - 1];
                return { file, proxyRef };
            });

            // 并发上传所有图片，每张通过对象引用独立更新状态（不依赖数组下标，避免并发偏移）
            await Promise.all(uploadTasks.map(async ({ file, proxyRef }) => {
                const fd = new FormData();
                fd.append('images[]', file);
                try {
                    const res = await fetch('/api/upload', { method: 'POST', body: fd, headers: authHeaders });
                    const json = await res.json();
                    if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                    if (json.code === 200) {
                        proxyRef.url = json.data.urls?.[0] || json.data.url || '';
                    } else {
                        showToast(json.msg || '上传失败', 'error');
                        proxyRef._failed = true;
                    }
                } catch {
                    showToast('上传失败', 'error');
                    proxyRef._failed = true;
                }
            }));

            // 统一清理所有上传失败的条目（从后往前 splice 避免索引偏移）
            for (let i = refImages.value.length - 1; i >= 0; i--) {
                if (refImages.value[i]._failed) {
                    refImages.value.splice(i, 1);
                }
            }

            isUploading.value = false;
            if (e.target && e.target.value !== undefined) e.target.value = '';
        };

        const removeUpload = (idx) => {
            const img = refImages.value[idx];
            if (img && img.preview && img.preview.startsWith('blob:')) {
                URL.revokeObjectURL(img.preview);
            }
            refImages.value.splice(idx, 1);
        };

        const clearUpload = () => {
            refImages.value.forEach(img => {
                if (img.preview && img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
            });
            refImages.value = [];
        };

        // Prompt & Generate
        const prompt = ref('');
        const isGenerating = ref(false);
        const generatingPrompt = ref('');
        const results = ref([]);

        // Pagination state
        const historyPage = ref(1);
        const hasMore = ref(false);
        const isLoadingMore = ref(false);

        const generateImage = async (override = null) => {
            const isOverride = override && typeof override === 'object' && !('type' in override && override.type === 'click') && override.prompt !== undefined;

            const currentPrompt = isOverride ? override.prompt : prompt.value;
            const currentImgUrls = isOverride ? (override.imageUrls || []) : uploadUrls.value;
            const currentGenModel = isOverride ? override.model : currentModel.value;

            if (!currentPrompt || !currentPrompt.trim()) {
                showToast('请输入提示词', 'error'); return;
            }
            if (!currentImgUrls || currentImgUrls.length === 0) {
                showToast('请先上传参考图片', 'error'); return;
            }
            // 检查是否还有图片正在上传中
            if (!isOverride && refImages.value.some(img => !img.url)) {
                showToast('部分图片还在上传中，请稍等', 'error'); return;
            }
            if (isGenerating.value || isUploading.value) return;

            isGenerating.value = true;
            generatingPrompt.value = currentPrompt;

            await nextTick();
            if (mainArea.value) {
                mainArea.value.scrollTo({ top: mainArea.value.scrollHeight, behavior: 'smooth' });
            }

            try {
                const payload = {
                    prompt: currentPrompt,
                    model: currentGenModel,
                    resolution: imageQuality.value,
                    ratio: imageRatio.value,
                    count: imageCount.value,
                };

                if (currentImgUrls && currentImgUrls.length > 0) {
                    payload.image_urls = currentImgUrls;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000);

                const res = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200) {
                    showToast(`生成成功！消耗 ${json.data.credits_cost} 积分`, 'success');
                    userCredits.value = json.data.credits_balance;
                    if (!override) {
                        prompt.value = '';
                        clearUpload();
                    }
                    await loadHistory();
                    if (mainArea.value) mainArea.value.scrollTo({ top: mainArea.value.scrollHeight, behavior: 'smooth' });
                } else {
                    showToast(json.msg || '生成失败', 'error');
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    showToast('生成超时，请稍后重试', 'error');
                } else {
                    showToast('网络错误', 'error');
                }
            }
            finally { isGenerating.value = false; }
        };

        // History item mapper
        const parseOriginalImages = (val) => {
            if (!val) return [];
            if (typeof val === 'string') {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) return parsed;
                } catch { }
                return [val];
            }
            return Array.isArray(val) ? val : [val];
        };

        const mapHistoryItem = (item) => ({
            groupId: item.group_id,
            id: item.first_id,
            prompt: item.prompt,
            model: item.model,
            originalImages: parseOriginalImages(item.original_image),
            images: item.images || [],
            resultText: item.result_text || null,
            time: item.create_time || '',
            creditsCost: item.credits_cost || 0,
            videoMeta: item.video_meta || null,
        });

        // Load latest history (page 1)
        const loadHistory = async () => {
            try {
                const res = await fetch('/api/history?page=1&page_size=10&type=image', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200 && json.data) {
                    results.value = json.data.map(mapHistoryItem).reverse();
                    hasMore.value = json.has_more || false;
                    historyPage.value = 1;
                }
            } catch (e) { console.error('加载历史失败', e); }
        };

        // Load more (older) history
        const loadMoreHistory = async () => {
            if (isLoadingMore.value || !hasMore.value) return;
            isLoadingMore.value = true;

            const nextPage = historyPage.value + 1;
            try {
                const res = await fetch(`/api/history?page=${nextPage}&page_size=10&type=image`, { headers: authHeaders });
                const json = await res.json();
                if (json.code === 200 && json.data && json.data.length > 0) {
                    const scrollEl = mainArea.value;
                    const prevScrollHeight = scrollEl ? scrollEl.scrollHeight : 0;

                    const olderItems = json.data.map(mapHistoryItem).reverse();
                    const existingIds = new Set(results.value.map(r => r.groupId));
                    const newItems = olderItems.filter(item => !existingIds.has(item.groupId));
                    results.value = [...newItems, ...results.value];

                    hasMore.value = json.has_more || false;
                    historyPage.value = nextPage;

                    await nextTick();
                    if (scrollEl) {
                        const newScrollHeight = scrollEl.scrollHeight;
                        scrollEl.scrollTop = newScrollHeight - prevScrollHeight;
                    }
                } else {
                    hasMore.value = false;
                }
            } catch (e) { console.error('加载更多历史失败', e); }
            finally { isLoadingMore.value = false; }
        };

        // Scroll handler
        const onMainScroll = () => {
            if (!mainArea.value || isLoadingMore.value || !hasMore.value) return;
            if (mainArea.value.scrollTop < 100) {
                loadMoreHistory();
            }
        };

        // Re-Edit & Regenerate
        const mainArea = ref(null);

        const reEdit = async (item) => {
            if (isGenerating.value) return;
            isRestoring.value = true;

            try {
                prompt.value = item.prompt;
                currentModel.value = item.model;

                await nextTick();

                refImages.value = [];

                if (item.originalImages && item.originalImages.length > 0) {
                    refImages.value = item.originalImages.map(url => ({ preview: url, url: url }));
                }

                showToast('参数已回填到下方控制台', 'success');

                if (item.videoMeta) {
                    if (item.videoMeta.ratio) {
                        imageRatio.value = item.videoMeta.ratio;
                    }
                    if (item.videoMeta.resolution) {
                        imageQuality.value = item.videoMeta.resolution;
                    }
                    if (item.videoMeta.count) {
                        imageCount.value = parseInt(item.videoMeta.count) || 1;
                    }
                }
            } finally {
                await nextTick();
                isRestoring.value = false;
            }
        };

        const regenerate = (item) => {
            if (isGenerating.value) return;
            generateImage({
                prompt: item.prompt,
                imageUrls: item.originalImages || [],
                model: item.model
            });
        };

        // Preview
        const previewUrl = ref(null);
        const previewMedia = (url) => {
            if (!url) return;
            previewUrl.value = url;
        };

        // Text detail modal
        const textDetailModal = ref({ show: false, title: '', content: '' });
        const showTextDetail = (title, content) => {
            if (!content) return;
            textDetailModal.value = { show: true, title, content };
        };

        // Credit history modal (已迁移到公共组件)
        const showCreditModal = ref(false);
        const creditLogList = ref([]);
        const loadCreditLogs = async () => { };

        const formatTime = (ts) => {
            if (!ts) return '';
            let d;
            if (typeof ts === 'string' && ts.includes('-')) {
                d = new Date(ts);
            } else {
                d = new Date(Number(ts) * 1000);
            }
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        // Avatar upload 和 logout 已迁移到公共头部组件
        const avatarInput = ref(null);
        const handleAvatarUpload = async () => { };
        const logout = () => { localStorage.clear(); window.location.href='/pages/login.html'; };

        // 公共头部组件事件处理
        const onUserLoaded = (info) => {
            userCredits.value = info.credits;
            userName.value = info.username;
            userAvatar.value = info.avatar || '';
            userRole.value = info.role || 0;
        };
        const onSiteLoaded = (info) => {
            siteName.value = info.siteName;
            siteLogo.value = info.siteLogo;
        };

        // Load data on mount
        const loadModels = async () => {
            try {
                const res = await fetch('/api/models');
                const json = await res.json();
                if (json.code === 200 && json.data) {
                    allModels.value = json.data;
                    const imgs = json.data.filter(m => m.type === 'image');
                    if (imgs.length > 0 && !currentModel.value) currentModel.value = imgs[0].model_key;
                }
            } catch { }
        };

        const loadSiteConfig = async () => { };
        const refreshUser = async () => { };

        onMounted(async () => {
            loadModels();
            await loadHistory();
            setTimeout(() => {
                if (mainArea.value) mainArea.value.scrollTo({ top: mainArea.value.scrollHeight, behavior: 'auto' });
            }, 100);
            if (mainArea.value) {
                mainArea.value.addEventListener('scroll', onMainScroll);
            }
        });

        // Close settings popover on mouse leave
        let settingsTimer = null;
        const onSettingsEnter = () => { clearTimeout(settingsTimer); showSettings.value = true; };
        const onSettingsLeave = () => { settingsTimer = setTimeout(() => { showSettings.value = false; }, 200); };

        // ==================== Asset Picker ====================
        const showAssetPicker = ref(false);
        const pickerTab = ref('local');
        const pickerDragging = ref(false);
        const pickerFileInput = ref(null);
        const pickerLoading = ref(false);
        const pickerAssetGroups = ref([]);
        const pickerSelectedUrls = ref([]);

        const openAssetPicker = () => {
            showAssetPicker.value = true;
            pickerTab.value = 'local';
            pickerSelectedUrls.value = [];
        };

        const closeAssetPicker = () => {
            showAssetPicker.value = false;
            pickerSelectedUrls.value = [];
        };

        // 加载用户资产库（仅加载用户手动上传的图片，不含AI生成）
        const loadPickerAssets = async () => {
            pickerLoading.value = true;
            try {
                const res = await fetch('/api/assets?page=1&page_size=100&tab=image&source=uploaded', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 200 && json.data) {
                    pickerAssetGroups.value = json.data.groups || [];
                }
            } catch (e) {
                showToast('加载资产失败', 'error');
            } finally {
                pickerLoading.value = false;
            }
        };

        // 切换资产选中状态
        const togglePickerAsset = (item) => {
            const idx = pickerSelectedUrls.value.indexOf(item.url);
            if (idx >= 0) {
                pickerSelectedUrls.value.splice(idx, 1);
            } else {
                pickerSelectedUrls.value.push(item.url);
            }
        };

        // 确认选择资产（资产已在服务器上，无需重新上传）
        const confirmPickerAssets = () => {
            for (const url of pickerSelectedUrls.value) {
                // 避免重复添加
                if (!refImages.value.some(img => img.url === url)) {
                    refImages.value.push({ preview: url, url: url });
                }
            }
            closeAssetPicker();
        };

        // 本地上传（弹窗内）
        const handlePickerLocalUpload = (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            // 走与主上传一致的逻辑（含 per-image spinner），关闭弹窗
            handleFileUpload(e);
            closeAssetPicker();
        };

        // 拖拽上传
        const handlePickerDrop = (e) => {
            pickerDragging.value = false;
            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            const mockEvent = { target: { files, value: '' } };
            handleFileUpload(mockEvent);
            closeAssetPicker();
        };

        return {
            toast, siteName, siteLogo,
            userName, userAvatar, userCredits, userRole, userInitial,
            allModels, imageModels, currentModel, currentModelObj, currentModelCost,
            modelDropOpen,
            imageRatio, imageQuality, imageCount, imageRatios, imageQualities, maxImageCount,
            showSettings, settingsLabel, mainArea,
            fileInput, refImages, uploadPreviews, uploadUrls, isUploading, handleFileUpload, clearUpload, removeUpload,
            prompt, isGenerating, generatingPrompt, results, generateImage, reEdit, regenerate,
            isLoadingMore, hasMore,
            previewUrl, previewMedia, totalCost,
            textDetailModal, showTextDetail,
            showCreditModal, creditLogList, loadCreditLogs, formatTime,
            avatarInput, handleAvatarUpload, logout,
            onUserLoaded, onSiteLoaded,
            onSettingsEnter, onSettingsLeave,
            // Asset Picker
            showAssetPicker, pickerTab, pickerDragging, pickerFileInput,
            pickerLoading, pickerAssetGroups, pickerSelectedUrls,
            openAssetPicker, closeAssetPicker, loadPickerAssets,
            togglePickerAsset, confirmPickerAssets,
            handlePickerLocalUpload, handlePickerDrop,
        };
    }
});
app.component('app-header', AppHeaderComponent);
app.mount('#app');
