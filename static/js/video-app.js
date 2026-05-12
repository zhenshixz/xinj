// Video Generation Page - App JavaScript (3-Step Wizard)
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
            setTimeout(() => { toast.value.show = false; }, type === 'error' ? 8000 : 5000);
        };
        const dismissToast = () => { toast.value.show = false; };

        // 监听公共头部组件的 toast 事件
        document.addEventListener('app-toast', (e) => {
            const { message, type } = e.detail;
            showToast(message, type);
        });

        // ==================== WIZARD STATE ====================
        // 1 = 录入需求, 1.5 = generating script transition, 2 = 脚本确认, 3 = 极速渲染
        const currentStep = ref(1);
        // 记录用户曾到达过的最大步骤，用于控制步骤导航器的可点击状态
        // 仅当走过一遍流程后（maxStepReached >= N），第 N 步才可以被点击跳转
        const maxStepReached = ref(1);

        // 步骤导航：点击步骤指示器时，仅允许跳转到已走过的步骤
        const goToStep = (step) => {
            if (step === currentStep.value) return; // 已在当前步骤
            if (step > maxStepReached.value) return; // 未走过的步骤不可跳转
            currentStep.value = step;
        };

        // ==================== PAGE MODE (简易 / 专业) ====================
        const pageMode = ref('simple'); // 'simple' | 'pro'

        // ==================== PROFESSIONAL MODE STATE ====================
        // 核心创意设定：核心动作 + 场景环境（由AI智能填充或手动输入）
        const coreAction = ref('');
        const sceneEnvironment = ref('');
        const isAiFilling = ref(false);

        // 分镜时长策略
        const shotStrategy = ref('auto'); // 'auto' | 'custom'

        // 是否启用分镜模式（仅 kling-v3 专业模式下有效，使用 multi_prompt 提交）
        const useMultiShot = ref(true);

        // 分镜列表（默认1个分镜）
        const shots = ref([
            { id: 1, duration: 0, description: '', cameraDesc: '', action: '', cameraAngle: '', cameraMovement: '', supplement: '', collapsed: false, _angleDropOpen: false, _moveDropOpen: false, dimSelections: {}, _dimDrops: {} }
        ]);

        // 模板配置维度（从后端加载：光影氛围、画面风格、画质增强等）
        const scriptDimensions = ref([]);
        const dimensionSelections = ref({});
        const dimDropOpenMap = ref({});

        // 按展示区域过滤维度
        const videoDimensions = computed(() => {
            return scriptDimensions.value.filter(d => d.show_in_video == 1);
        });
        const storyboardDimensions = computed(() => {
            return scriptDimensions.value.filter(d => d.show_in_storyboard == 1);
        });

        // 分镜中可选的镜头景别和运动方向（从scriptDimensions中按code提取）
        const cameraAngleOptions = computed(() => {
            const dim = scriptDimensions.value.find(d => d.code === 'camera_angle');
            return dim ? dim.options : [];
        });
        const cameraMoveOptions = computed(() => {
            const dim = scriptDimensions.value.find(d => d.code === 'camera_movement');
            return dim ? dim.options : [];
        });

        // 专业模式下的 contenteditable ref（与简易模式共用 prompt 变量）
        const proPromptTextarea = ref(null);

        // ---- 分镜时长均分算法 ----
        const calcShotDurations = (totalDuration, shotCount) => {
            const total = parseInt(totalDuration) || 8;
            if (shotCount <= 0) return [];
            const base = Math.floor(total / shotCount);
            const remainder = total % shotCount;
            // 前(shotCount - remainder)个为base秒，后remainder个为(base+1)秒
            return Array.from({ length: shotCount }, (_, i) =>
                i < (shotCount - remainder) ? base : base + 1
            );
        };

        // 自动均分时，当时长或分镜数变化时重新计算
        const recalcShotDurations = () => {
            if (shotStrategy.value !== 'auto') return;
            const durations = calcShotDurations(videoDuration.value, shots.value.length);
            shots.value.forEach((shot, i) => {
                shot.duration = durations[i] || 0;
            });
        };

        // 获取分镜时间范围显示（如 "0-3s"）
        const getShotTimeRange = (idx) => {
            let start = 0;
            for (let i = 0; i < idx; i++) start += shots.value[i].duration;
            const end = start + shots.value[idx].duration;
            return `${start}-${end}s`;
        };

        // 获取分镜景别/运动方向的显示标签
        const getShotAngleLabel = (shot) => {
            if (!shot.cameraAngle) return '请选择';
            const opt = cameraAngleOptions.value.find(o => o.id === shot.cameraAngle);
            return opt ? opt.label : '请选择';
        };
        const getShotMoveLabel = (shot) => {
            if (!shot.cameraMovement) return '请选择';
            const opt = cameraMoveOptions.value.find(o => o.id === shot.cameraMovement);
            return opt ? opt.label : '请选择';
        };

        // ---- 分镜维度动态选择辅助函数 ----

        // 切换分镜中某维度下拉的展开/收起（互斥：打开一个则关闭其它）
        const toggleShotDimDrop = (shot, dimId) => {
            if (!shot._dimDrops) shot._dimDrops = {};
            const willOpen = !shot._dimDrops[dimId];
            // 先关闭该分镜内所有下拉
            Object.keys(shot._dimDrops).forEach(k => { shot._dimDrops[k] = false; });
            shot._dimDrops[dimId] = willOpen;
        };

        // 获取分镜中某维度已选选项的标签
        const getShotDimLabel = (shot, dim) => {
            const selectedId = shot.dimSelections && shot.dimSelections[dim.id];
            if (!selectedId) return '请选择';
            const opt = dim.options?.find(o => o.id === selectedId);
            return opt ? opt.label : '请选择';
        };

        // 设置分镜中某维度的选项值并关闭下拉
        const setShotDimSelection = (shot, dimId, optId) => {
            if (!shot.dimSelections) shot.dimSelections = {};
            shot.dimSelections[dimId] = optId;
            if (shot._dimDrops) shot._dimDrops[dimId] = false;
        };

        // 获取分镜中某维度已选的完整选项对象
        const getShotDimSelectedOpt = (shot, dim) => {
            const selectedId = shot.dimSelections && shot.dimSelections[dim.id];
            if (!selectedId) return null;
            return dim.options?.find(o => o.id === selectedId) || null;
        };

        // 新增分镜（Kling V3 API 最多支持 6 个分镜）
        const addShot = () => {
            if (shots.value.length >= 6) {
                showToast('最多支持 6 个分镜', 'error');
                return;
            }
            const newId = shots.value.length > 0 ? Math.max(...shots.value.map(s => s.id)) + 1 : 1;
            shots.value.push({
                id: newId, duration: 0, description: '', cameraDesc: '', action: '',
                cameraAngle: '', cameraMovement: '', supplement: '', collapsed: false,
                _angleDropOpen: false, _moveDropOpen: false,
                dimSelections: {}, _dimDrops: {}
            });
            recalcShotDurations();
        };

        // 删除分镜
        const removeShot = (idx) => {
            if (shots.value.length <= 1) return;
            shots.value.splice(idx, 1);
            recalcShotDurations();
        };

        // 自定义模式下更新单个分镜时长
        const updateShotDuration = (idx, e) => {
            const val = parseInt(e.target.value) || 0;
            const maxDur = parseInt(videoDuration.value) || 8;
            shots.value[idx].duration = Math.min(Math.max(val, 1), maxDur);
        };

        // 切换维度下拉
        const toggleDimDrop = (dimId) => {
            // 关闭其它维度下拉
            Object.keys(dimDropOpenMap.value).forEach(k => {
                if (parseInt(k) !== dimId) dimDropOpenMap.value[k] = false;
            });
            dimDropOpenMap.value[dimId] = !dimDropOpenMap.value[dimId];
        };

        // 获取维度已选标签
        const getDimSelectedLabel = (dim) => {
            const selectedId = dimensionSelections.value[dim.id];
            if (!selectedId) return '请选择';
            const opt = dim.options?.find(o => o.id === selectedId);
            return opt ? opt.label : '请选择';
        };

        // 获取维度已选的完整选项对象（含 note、image 等字段）
        const getDimSelectedOption = (dim) => {
            const selectedId = dimensionSelections.value[dim.id];
            if (!selectedId) return null;
            return dim.options?.find(o => o.id === selectedId) || null;
        };

        // 点击维度注解/图片区域：弹出详情弹窗（左图右信息）
        const dimDetailModal = ref({ show: false, dimName: '', dimCode: '', optLabel: '', optNote: '', optPromptText: '', optImage: '' });
        const viewDimDetail = (dim, opt) => {
            if (!opt) return;
            dimDetailModal.value = {
                show: true,
                dimName: dim.name || '',
                dimCode: dim.code || '',
                optLabel: opt.label || '',
                optNote: opt.note || '',
                optPromptText: opt.prompt_text || '',
                optImage: opt.image || '',
            };
        };
        const closeDimDetailModal = () => {
            dimDetailModal.value.show = false;
        };
        // 保留旧接口兼容（分镜区域也使用）
        const dimImageLightbox = ref({ show: false });
        const viewDimOptionImage = (opt) => { /* 不再使用，保留防报错 */ };
        const closeDimImageLightbox = () => { dimImageLightbox.value.show = false; };

        // 关闭所有专业模式下拉（供互斥使用）
        const closeAllProDropdowns = (except) => {
            if (except !== 'duration') durationDropOpen.value = false;
            if (except !== 'ratio') ratioDropOpen.value = false;
            if (except !== 'res') resDropOpen.value = false;
            if (except !== 'mode') modeDropOpen.value = false;
            if (except !== 'videoModel') videoModelDropOpen.value = false;
            if (except !== 'promptModel') promptModelDropOpen.value = false;
            if (except !== 'sound') soundDropOpen.value = false;
            Object.keys(dimDropOpenMap.value).forEach(k => { dimDropOpenMap.value[k] = false; });
        };

        // ---- 加载模板配置 ----
        const loadScriptDimensions = async () => {
            try {
                const res = await fetch('/api/script/dimensions', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 200 && json.data) {
                    scriptDimensions.value = json.data;
                    // 初始化维度下拉状态和默认选择
                    json.data.forEach(dim => {
                        dimDropOpenMap.value[dim.id] = false;
                        // 默认选中第一个选项
                        if (dim.options && dim.options.length > 0 && !dimensionSelections.value[dim.id]) {
                            dimensionSelections.value[dim.id] = dim.options[0].id;
                        }
                    });
                }
            } catch (err) {
                console.error('加载模板配置失败', err);
            }
        };

        // ---- AI智能填充：调用后端专用接口，自动回填所有创意字段 ----
        const aiSmartFill = async () => {
            if (!prompt.value.trim()) {
                showToast('请先输入主体描述', 'error');
                return;
            }
            if (!hasRefImage.value) {
                showToast('请至少上传1张参考图', 'error');
                return;
            }
            if (!currentPromptModel.value) {
                showToast('请选择脚本模型', 'error');
                return;
            }
            if (isAiFilling.value) return;

            isAiFilling.value = true;
            try {
                const payload = {
                    prompt: prompt.value,
                    image_url: firstImageUrl.value,
                    model: currentPromptModel.value,
                    video_duration: videoDuration.value || '5',
                    video_model: currentModel.value || '',
                    frame_mode: frameMode.value || 'single',
                };

                // 首尾帧模式下传帧模式标识，后端据此选择「首尾帧提示词」段落
                if (pageMode.value === 'pro' && isKlingV3Model.value && frameMode.value === 'dual') {
                    payload.frame_mode = 'dual';
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 90000);

                const res = await fetch('/api/ai-smart-fill', {
                    method: 'POST',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200 && json.data) {
                    const data = json.data;

                    // 回填优化后的主体描述（AI 根据图片和用户描述优化后的文本）
                    if (data.optimized_prompt) {
                        prompt.value = data.optimized_prompt;
                        // 将纯文本中的 @图片N 转换为 mention-chip HTML，保持引用功能正常
                        const chipHtml = promptTextToChipHtml(data.optimized_prompt);
                        promptHtml.value = chipHtml;
                        nextTick(() => {
                            const el = proPromptTextarea.value || promptTextarea.value;
                            if (el) {
                                el.innerHTML = chipHtml;
                                // 从 DOM 同步回 promptHtml 和 prompt（确保一致性）
                                syncPromptFromEditable();
                            }
                        });
                    }

                    // 回填核心动作和场景环境
                    if (data.core_action) coreAction.value = data.core_action;
                    if (data.scene_environment) sceneEnvironment.value = data.scene_environment;

                    // 回填维度选择（镜头视角、镜头运动方向、画面风格、光影氛围、画质增强等）
                    // 后端返回格式: { "camera_angle": 3, "camera_movement": 7, ... }
                    // 前端 dimensionSelections 格式: { dimension_id: option_id }
                    if (data.dimension_selections && typeof data.dimension_selections === 'object') {
                        for (const dim of scriptDimensions.value) {
                            const code = dim.code;
                            if (code && data.dimension_selections[code] !== undefined) {
                                const optionId = data.dimension_selections[code];
                                // 验证该选项确实属于该维度
                                const validOpt = dim.options?.find(o => o.id === optionId);
                                if (validOpt) {
                                    dimensionSelections.value[dim.id] = optionId;
                                }
                            }
                        }
                    }

                    showToast('AI智能填充完成', 'success');
                } else {
                    showToast(json.msg || 'AI分析失败', 'error');
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    showToast('AI分析超时，请稍后重试', 'error');
                } else {
                    showToast('网络错误', 'error');
                }
            } finally {
                isAiFilling.value = false;
            }
        };

        // ---- 智能分镜：AI 自动生成分镜信息 ----
        const isSmartStoryboarding = ref(false);
        const specifiedShotCount = ref('');  // 用户指定分镜数，空=AI自行决定
        // 分镜数上限：固定为 6（Kling V3 API 最多支持 6 个分镜）
        const maxShotCount = computed(() => 6);

        // 判断当前视频模型是否为可灵系列（用于控制分镜模式开关显示，支持 kling-v3 和 kling-v2-6）
        const isKlingV3Model = computed(() => {
            return ['kling-v3', 'kling-v2-6'].includes(currentModel.value);
        });

        const aiSmartStoryboard = async () => {
            if (!prompt.value.trim()) {
                showToast('请先输入主体描述', 'error');
                return;
            }
            if (!hasRefImage.value) {
                showToast('请至少上传1张参考图', 'error');
                return;
            }
            if (!currentPromptModel.value) {
                showToast('请选择脚本模型', 'error');
                return;
            }
            if (isSmartStoryboarding.value) return;

            isSmartStoryboarding.value = true;
            try {
                // 收集已选视频参数维度（名称 → 已选标签）
                const dimSelectionsPayload = {};
                for (const dim of scriptDimensions.value) {
                    const selectedOptId = dimensionSelections.value[dim.id];
                    if (selectedOptId) {
                        const opt = dim.options?.find(o => o.id === selectedOptId);
                        if (opt) {
                            dimSelectionsPayload[dim.name] = opt.label;
                        }
                    }
                }

                const payload = {
                    prompt: prompt.value,
                    image_url: firstImageUrl.value,
                    model: currentPromptModel.value,
                    video_duration: videoDuration.value || '5',
                    core_action: coreAction.value || '',
                    scene_environment: sceneEnvironment.value || '',
                    dimension_selections: dimSelectionsPayload,
                    shot_count: specifiedShotCount.value ? parseInt(specifiedShotCount.value) : 0,
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000);

                const res = await fetch('/api/ai-smart-storyboard', {
                    method: 'POST',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200 && json.data && json.data.shots) {
                    const aiShots = json.data.shots;

                    // 用 AI 返回的分镜数据替换当前 shots
                    shots.value = aiShots.map((s, i) => {
                        const newShot = {
                            id: i + 1,
                            duration: s.duration || 0,
                            description: s.description || '',
                            cameraDesc: s.camera_desc || '',
                            action: s.action || '',
                            cameraAngle: '',
                            cameraMovement: '',
                            supplement: '',
                            collapsed: false,
                            _angleDropOpen: false,
                            _moveDropOpen: false,
                            dimSelections: {},
                            _dimDrops: {},
                        };

                        // 回填分镜维度选项（AI 返回的 dim_selections: { code: option_id }）
                        if (s.dim_selections && typeof s.dim_selections === 'object') {
                            for (const dim of storyboardDimensions.value) {
                                const code = dim.code;
                                if (code && s.dim_selections[code] !== undefined) {
                                    const optId = s.dim_selections[code];
                                    const validOpt = dim.options?.find(o => o.id === optId);
                                    if (validOpt) {
                                        newShot.dimSelections[dim.id] = optId;
                                    }
                                }
                            }
                        }

                        return newShot;
                    });

                    showToast(`AI 智能分镜完成，已生成 ${aiShots.length} 个分镜`, 'success');
                } else {
                    showToast(json.msg || 'AI 智能分镜失败', 'error');
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    showToast('AI 智能分镜超时，请稍后重试', 'error');
                } else {
                    showToast('网络错误', 'error');
                }
            } finally {
                isSmartStoryboarding.value = false;
            }
        };

        // ---- 智能重填单个分镜 ----
        const aiRefillShot = async (shotIndex) => {
            if (!prompt.value.trim()) {
                showToast('请先输入主体描述', 'error');
                return;
            }
            if (!hasRefImage.value) {
                showToast('请至少上传1张参考图', 'error');
                return;
            }
            if (!currentPromptModel.value) {
                showToast('请选择脚本模型', 'error');
                return;
            }

            const shot = shots.value[shotIndex];
            if (!shot) {
                showToast('分镜不存在', 'error');
                return;
            }

            // 避免重复点击：使用 shot 上的标记
            if (shot._refilling) return;
            shot._refilling = true;

            try {
                // 收集已选视频参数维度
                const dimSelectionsPayload = {};
                for (const dim of scriptDimensions.value) {
                    const selectedOptId = dimensionSelections.value[dim.id];
                    if (selectedOptId) {
                        const opt = dim.options?.find(o => o.id === selectedOptId);
                        if (opt) {
                            dimSelectionsPayload[dim.name] = opt.label;
                        }
                    }
                }

                // 收集所有其它分镜的完整信息（排除当前分镜），让 AI 了解完整上下文
                const otherShots = shots.value
                    .map((s, i) => {
                        if (i === shotIndex) return null;
                        const shotInfo = {
                            index: i,
                            duration: s.duration,
                            description: s.description || '',
                            camera_desc: s.cameraDesc || '',
                            action: s.action || '',
                        };
                        // 收集该分镜已选的维度（label 而非 ID，方便 AI 阅读）
                        const dimLabels = {};
                        if (s.dimSelections) {
                            for (const dim of storyboardDimensions.value) {
                                const selId = s.dimSelections[dim.id];
                                if (selId) {
                                    const opt = dim.options?.find(o => o.id === selId);
                                    if (opt) dimLabels[dim.name] = opt.label;
                                }
                            }
                        }
                        if (Object.keys(dimLabels).length > 0) shotInfo.dim_labels = dimLabels;
                        return shotInfo;
                    })
                    .filter(Boolean);

                const payload = {
                    prompt: prompt.value,
                    image_url: firstImageUrl.value,
                    model: currentPromptModel.value,
                    video_duration: videoDuration.value || '5',
                    core_action: coreAction.value || '',
                    scene_environment: sceneEnvironment.value || '',
                    dimension_selections: dimSelectionsPayload,
                    shot_index: shotIndex,
                    total_shots: shots.value.length,
                    shot_duration: shot.duration || 0,
                    other_shots: otherShots,
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000);

                const res = await fetch('/api/ai-refill-shot', {
                    method: 'POST',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200 && json.data && json.data.shot) {
                    const s = json.data.shot;

                    // 回填分镜信息（保留 id、duration 等结构属性不变）
                    shot.description = s.description || '';
                    shot.cameraDesc = s.camera_desc || '';
                    shot.action = s.action || '';

                    // 回填维度选择
                    if (s.dim_selections && typeof s.dim_selections === 'object') {
                        for (const dim of storyboardDimensions.value) {
                            const code = dim.code;
                            if (code && s.dim_selections[code] !== undefined) {
                                const optId = s.dim_selections[code];
                                const validOpt = dim.options?.find(o => o.id === optId);
                                if (validOpt) {
                                    if (!shot.dimSelections) shot.dimSelections = {};
                                    shot.dimSelections[dim.id] = optId;
                                }
                            }
                        }
                    }

                    showToast(`分镜 ${shotIndex + 1} 已智能重填`, 'success');
                } else {
                    showToast(json.msg || '智能重填失败', 'error');
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    showToast('智能重填超时，请稍后重试', 'error');
                } else {
                    showToast('网络错误', 'error');
                }
            } finally {
                shot._refilling = false;
            }
        };

        // ---- 从格式化系统提示词中提取指定段落 ----
        // 系统提示词可包含「默认提示词」「分镜提示词」「首尾帧提示词」三个标记段落，
        // 如果找不到标记则返回完整原文（向后兼容无标记的旧配置）
        const extractPromptSection = (fullPrompt, section) => {
            const markers = {
                default: ['========= 默认提示词 开始 =========', '========= 默认提示词 结束 ========='],
                storyboard: ['========= 分镜提示词 开始 =========', '========= 分镜提示词 结束 ========='],
                first_last_frame: ['========= 首尾帧提示词 开始 =========', '========= 首尾帧提示词 结束 ========='],
            };
            const pair = markers[section];
            if (!pair) return fullPrompt;
            const [startMarker, endMarker] = pair;
            const startIdx = fullPrompt.indexOf(startMarker);
            const endIdx = fullPrompt.indexOf(endMarker);
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return fullPrompt;
            return fullPrompt.substring(startIdx + startMarker.length, endIdx).trim();
        };

        // ---- 组装完整的视频脚本提示词（提取为公共方法，供生成和预览共用） ----
        // 注意：此处组装的内容将直接作为 prompt 发送给视频生成模型，
        // 不应包含系统提示词（系统提示词仅用于指导提示词AI，不应泄漏到视频生成中）
        const buildStoryPrompt = () => {
            let storyPrompt = '';

            storyPrompt += `【视频脚本生成请求】\n\n`;

            // ── 1. 核心创意设定 ──
            storyPrompt += `═══ 核心创意设定 ═══\n`;
            storyPrompt += `主体描述：${prompt.value}\n`;
            if (coreAction.value) storyPrompt += `核心动作：${coreAction.value}\n`;
            if (sceneEnvironment.value) storyPrompt += `场景环境：${sceneEnvironment.value}\n`;
            storyPrompt += `视频总时长：${videoDuration.value}秒\n`;

            // ── 2. 视频参数（所有 show_in_video=1 的维度选择结果）──
            const videoParamLines = [];
            videoDimensions.value.forEach(dim => {
                const selectedId = dimensionSelections.value[dim.id];
                if (selectedId) {
                    const opt = dim.options?.find(o => o.id === selectedId);
                    if (opt) {
                        let line = `${dim.name}：${opt.label}`;
                        // prompt_text 是给视频生成模型用的核心提示词
                        if (opt.prompt_text) line += `（提示词：${opt.prompt_text}）`;
                        videoParamLines.push(line);
                    }
                }
            });
            if (videoParamLines.length > 0) {
                storyPrompt += `\n═══ 视频参数（已选定，请严格遵循）═══\n`;
                videoParamLines.forEach(l => { storyPrompt += `  - ${l}\n`; });
            }

            // ── 3. 分镜脚本（每个分镜的完整信息）──
            storyPrompt += `\n═══ 分镜脚本（共 ${shots.value.length} 个分镜）═══\n`;
            shots.value.forEach((shot, i) => {
                storyPrompt += `\n--- 分镜${i + 1}（${shot.duration}秒）---\n`;
                if (shot.description) storyPrompt += `分镜描述：${shot.description}\n`;
                if (shot.cameraDesc) storyPrompt += `场景描述：${shot.cameraDesc}\n`;
                if (shot.action) storyPrompt += `人物动作：${shot.action}\n`;

                // 分镜中的动态维度选择（show_in_storyboard=1）
                storyboardDimensions.value.forEach(dim => {
                    const optId = shot.dimSelections?.[dim.id];
                    if (optId) {
                        const opt = dim.options?.find(o => o.id === optId);
                        if (opt) {
                            let dimLine = `${dim.name}：${opt.label}`;
                            if (opt.prompt_text) dimLine += `（提示词：${opt.prompt_text}）`;
                            storyPrompt += `${dimLine}\n`;
                        }
                    }
                });

                // 补充画面指令（用户手动填写的）
                if (shot.supplement) storyPrompt += `补充画面指令：${shot.supplement}\n`;
            });

            return storyPrompt;
        };

        // ---- 组装简洁的视频生成提示词（直接发送给视频模型） ----
        // 与 buildStoryPrompt 不同，此函数不包含元指令标题、结构化格式等
        // 仅输出视觉描述内容，适合作为视频生成模型（如 Kling、Seedance）的 prompt
        const buildVideoPrompt = () => {
            const parts = [];

            // 主体描述（核心内容）
            if (prompt.value.trim()) {
                parts.push(prompt.value.trim());
            }

            // 核心动作
            if (coreAction.value.trim()) {
                parts.push(coreAction.value.trim());
            }

            // 场景环境
            if (sceneEnvironment.value.trim()) {
                parts.push(sceneEnvironment.value.trim());
            }

            // 视频参数维度的 prompt_text（如画面风格、光影氛围等的实际提示词）
            videoDimensions.value.forEach(dim => {
                const selectedId = dimensionSelections.value[dim.id];
                if (selectedId) {
                    const opt = dim.options?.find(o => o.id === selectedId);
                    if (opt && opt.prompt_text) {
                        parts.push(opt.prompt_text);
                    }
                }
            });

            // 分镜中各维度的 prompt_text
            // 首尾帧模式下不拼入分镜信息（image_tail 使用单一 prompt，不含分镜结构数据）
            const skipShots = frameMode.value === 'dual' && isKlingV3Model.value;
            if (!skipShots) {
                shots.value.forEach(shot => {
                    storyboardDimensions.value.forEach(dim => {
                        const optId = shot.dimSelections?.[dim.id];
                        if (optId) {
                            const opt = dim.options?.find(o => o.id === optId);
                            if (opt && opt.prompt_text) {
                                parts.push(opt.prompt_text);
                            }
                        }
                    });
                    // 补充画面指令
                    if (shot.supplement && shot.supplement.trim()) {
                        parts.push(shot.supplement.trim());
                    }
                });
            }

            return parts.join('，');
        };

        // ---- 预览提示词（仅 admin 可用，不提交生成视频） ----
        const promptPreviewModal = ref({ show: false, content: '' });
        const previewPrompt = () => {
            const assembled = buildStoryPrompt();
            promptPreviewModal.value = { show: true, content: assembled };
        };
        const copyPreviewPrompt = async () => {
            try {
                await navigator.clipboard.writeText(promptPreviewModal.value.content);
                showToast('提示词已复制到剪贴板', 'success');
            } catch {
                showToast('复制失败，请手动选择复制', 'error');
            }
        };

        // ---- 生成可视化故事板（专业模式步骤1→步骤2）----
        const generateStoryboard = async () => {
            if (!prompt.value.trim()) {
                showToast('请输入主体描述', 'error');
                return;
            }
            if (!hasRefImage.value) {
                showToast('请上传产品参考图', 'error');
                return;
            }
            if (!currentPromptModel.value) {
                showToast('请选择脚本模型', 'error');
                return;
            }
            if (isGeneratingScript.value) return;

            isGeneratingScript.value = true;
            currentStep.value = 2;

            try {
                const storyPrompt = buildStoryPrompt();

                // 将组装好的脚本文本赋值到步骤2，方便用户查看提示词内容
                scriptContent.value = storyPrompt;
                currentStep.value = 2;
                if (maxStepReached.value < 2) maxStepReached.value = 2;

                // 直接调用步骤2→步骤3的确认并渲染
                showToast('脚本已组装完成，正在提交生成视频...', 'success');
                await confirmAndRender();

            } catch (err) {
                showToast('组装脚本失败: ' + (err.message || '未知错误'), 'error');
                currentStep.value = 1;
            } finally {
                isGeneratingScript.value = false;
            }
        };

        // ==================== MODELS ====================
        const allModels = ref([]);
        const videoModels = computed(() => allModels.value.filter(m => m.type === 'video'));
        const currentModel = ref('');
        const currentModelObj = computed(() => allModels.value.find(x => x.model_key === currentModel.value));
        const currentModelCost = computed(() => currentModelObj.value ? currentModelObj.value.credits_cost : 0);
        const totalCost = computed(() => currentModelCost.value);

        // Prompt model (user-selectable)
        const promptModels = computed(() => allModels.value.filter(m => m.type === 'prompt'));
        const currentPromptModel = ref('');
        const currentPromptModelObj = computed(() => allModels.value.find(x => x.model_key === currentPromptModel.value));

        // 自定义下拉框的展开/收起状态
        const videoModelDropOpen = ref(false);
        const promptModelDropOpen = ref(false);
        const ratioDropOpen = ref(false);
        const resDropOpen = ref(false);
        const modeDropOpen = ref(false);
        const durationDropOpen = ref(false);
        const soundDropOpen = ref(false);

        // 点击页面其他区域时关闭所有自定义下拉框
        document.addEventListener('click', () => {
            videoModelDropOpen.value = false;
            promptModelDropOpen.value = false;
            ratioDropOpen.value = false;
            resDropOpen.value = false;
            modeDropOpen.value = false;
            durationDropOpen.value = false;
            soundDropOpen.value = false;
        });

        // ==================== VIDEO SETTINGS (Step 1) ====================
        const videoRatio = ref('16:9');
        const videoDuration = ref('8');
        const videoResolution = ref('720p');
        const videoRatios = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return caps?.aspect_ratios || ['16:9', '1:1', '9:16'];
        });
        const videoDurations = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            const durs = caps?.duration_seconds || caps?.durations || [];
            return [...durs].sort((a, b) => parseInt(a) - parseInt(b));
        });
        const videoResolutions = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return caps?.resolutions || [];
        });
        const generateAudio = ref(true);
        const isDraft = ref(false);
        const availableVideoResolutions = computed(() => videoResolutions.value);

        // 生成模式（标准/高品质），用于可灵等不按分辨率区分的模型
        const videoMode = ref('std');
        const videoModes = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return caps?.modes || [];  // 如 ['std', 'pro']
        });
        // 模式的中文标签映射
        const videoModeLabels = { 'std': '标准模式', 'pro': '高品质模式' };

        // 声音开关（仅对支持 user_selectable_audio 的模型显示，如 kling-v2-6）
        const soundEnabled = ref(true);
        // 是否显示声音开关：模型能力中 user_selectable_audio=true 时才显示
        const showSoundToggle = computed(() => {
            const caps = currentModelObj.value?.capabilities;
            return !!(caps?.user_selectable_audio);
        });
        // 声音下拉选项
        const soundOptions = ['on', 'off'];
        const soundLabels = { 'on': '开启声音', 'off': '关闭声音' };

        // 比例选择器锁定：可灵 image2video 端点会忽略 aspect_ratio 参数，
        // 自动使用首帧图片的宽高比。可灵模型的所有模式（简易/专业/首帧分镜/首尾帧）
        // 都要求上传参考图，必走 image2video，因此选中可灵模型即锁定比例选择器。
        const isRatioLocked = computed(() => isKlingV3Model.value);

        // ==================== FRAME MODE (首帧分镜 / 首尾帧) ====================
        // 仅 kling-v3 专业模式下使用，'single'=首帧分镜模式（默认），'dual'=首尾帧模式
        const frameMode = ref('single');

        // 首尾帧模式下的两张图片状态（首帧对应 image，尾帧对应 image_tail）
        const tailFrameFirst = ref({ preview: '', url: '' });
        const tailFrameLast = ref({ preview: '', url: '' });
        // 记录当前正在上传的目标槽位 ('first' 或 'last')，由 asset picker 的 handlePickerLocalUpload/Drop 设置
        let tailFrameUploadTarget = 'first';

        // 处理首尾帧模式图片上传
        const handleTailFrameUpload = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const target = tailFrameUploadTarget;
            const frameRef = target === 'first' ? tailFrameFirst : tailFrameLast;

            // 本地预览
            frameRef.value = { preview: URL.createObjectURL(file), url: '' };

            // 上传到服务器
            const fd = new FormData();
            fd.append('images[]', file);
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: fd, headers: authHeaders });
                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200) {
                    const uploadedUrl = json.data.urls?.[0] || json.data.url || '';
                    if (!uploadedUrl) throw new Error('上传返回无效URL');
                    frameRef.value.url = uploadedUrl;
                } else {
                    showToast(json.msg || '上传失败', 'error');
                    frameRef.value = { preview: '', url: '' };
                }
            } catch (err) {
                showToast('图片上传失败', 'error');
                frameRef.value = { preview: '', url: '' };
            }
            e.target.value = '';
        };

        // 清除首帧/尾帧图片
        const removeTailFrame = (target) => {
            if (!target || typeof target !== 'string') return;
            if (target === 'first') {
                tailFrameFirst.value = { preview: '', url: '' };
            } else {
                tailFrameLast.value = { preview: '', url: '' };
            }
        };

        // ==================== MULTI-IMAGE UPLOAD ====================
        // Compute max upload images: take the MAX across script model and video model
        const maxUploadImages = computed(() => {
            const scriptMax = currentPromptModelObj.value?.capabilities?.max_upload_images || 0;
            const videoMax = currentModelObj.value?.capabilities?.max_upload_images || 0;
            const result = Math.max(scriptMax, videoMax);
            // Default to 1 if both are 0 but image input is supported
            if (result === 0) {
                const supportsImg = currentModelObj.value?.capabilities?.supports_image_input ||
                    currentModelObj.value?.capabilities?.supports_first_frame;
                return supportsImg ? 1 : 0;
            }
            return result;
        });

        // Array of uploaded reference images: [{preview: '', url: ''}]
        const refImages = ref([]);
        const frameUploading = ref(false);

        // Check if we can still add more images
        const canAddMoreImages = computed(() => {
            return maxUploadImages.value > 0 && refImages.value.length < maxUploadImages.value;
        });

        // 支持一次选择多张图片批量上传，超出剩余可用槽位的部分自动截断取前 N 张
        const uploadRefImage = async (e) => {
            const selectedFiles = Array.from(e.target.files || []);
            if (selectedFiles.length === 0) return;

            // 计算剩余可上传张数
            const remaining = maxUploadImages.value - refImages.value.length;
            if (remaining <= 0) {
                showToast(`最多只能上传 ${maxUploadImages.value} 张参考图`, 'error');
                e.target.value = '';
                return;
            }

            // 截断：只取剩余槽位数量的文件
            const filesToUpload = selectedFiles.slice(0, remaining);
            if (selectedFiles.length > remaining) {
                showToast(`已自动选取前 ${remaining} 张，当前模型最多支持 ${maxUploadImages.value} 张参考图`, 'error');
            }

            frameUploading.value = true;

            // 为每张图先创建本地预览占位（立即显示加载动画）
            // 注意：push 进 ref 数组后，Vue 3 会将对象包裹为响应式代理，
            // 后续赋值必须通过数组中的代理引用，否则不会触发 UI 更新
            const uploadTasks = filesToUpload.map(file => {
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

            frameUploading.value = false;
            e.target.value = '';
        };

        const removeRefImage = (idx) => {
            refImages.value.splice(idx, 1);
        };

        // Convenience: check if at least one image is uploaded
        // 在首尾帧模式下，检查首帧是否已上传（首帧为必须，尾帧为可选）
        const hasRefImage = computed(() => {
            if (frameMode.value === 'dual' && isKlingV3Model.value) {
                return !!tailFrameFirst.value.url;
            }
            return refImages.value.length > 0 && refImages.value[0].url;
        });

        // Legacy compatibility: first image URL
        // 在首尾帧模式下，首帧图片也提供给 AI 智能填充/分镜等功能使用
        const firstImageUrl = computed(() => {
            if (frameMode.value === 'dual' && isKlingV3Model.value && tailFrameFirst.value.url) {
                return tailFrameFirst.value.url;
            }
            return refImages.value.length > 0 ? refImages.value[0].url : '';
        });

        // All uploaded image URLs
        const allRefImageUrls = computed(() => refImages.value.filter(img => img.url).map(img => img.url));

        // When model changes, reset settings
        watch(currentModel, () => {
            const caps = currentModelObj.value?.capabilities;
            if (caps) {
                if (caps.aspect_ratios && caps.aspect_ratios.length > 0 && !caps.aspect_ratios.includes(videoRatio.value)) {
                    videoRatio.value = caps.aspect_ratios[0];
                }
                if (caps.resolutions && caps.resolutions.length > 0 && !caps.resolutions.includes(videoResolution.value)) {
                    videoResolution.value = caps.resolutions[0];
                }
                // 可灵等模型使用 modes 而不是 resolutions
                if (caps.modes && caps.modes.length > 0 && !caps.modes.includes(videoMode.value)) {
                    videoMode.value = caps.modes[0];
                }
                let durs = caps.duration_seconds || caps.durations || [];
                durs = [...durs].sort((a, b) => parseInt(a) - parseInt(b));
                if (durs.length > 0 && !durs.includes(videoDuration.value)) {
                    videoDuration.value = durs[0];
                }
                // Don't clear uploaded images when switching models, but trim if over new max
                const newMax = Math.max(
                    currentPromptModelObj.value?.capabilities?.max_upload_images || 0,
                    caps.max_upload_images || 0
                ) || 1;
                if (refImages.value.length > newMax) {
                    refImages.value.splice(newMax);
                }
                generateAudio.value = true;
                isDraft.value = false;

                // 切换模型时，如果新模型不是 kling-v3 系列则重置首尾帧模式
                if (!['kling-v3', 'kling-v2-6'].includes(currentModel.value)) {
                    frameMode.value = 'single';
                    tailFrameFirst.value = { preview: '', url: '' };
                    tailFrameLast.value = { preview: '', url: '' };
                }
            }
        });

        // ==================== @MENTION: contenteditable 富文本编辑 + @图片标签芯片 ====================
        const promptTextarea = ref(null);
        const showMentionPopup = ref(false);
        const mentionPopupPos = ref({ top: 0, left: 0 }); // 弹出框跟随光标位置
        const mentionActiveIdx = ref(0);
        // 延时关闭句柄，用于区分点击弹窗条目（mousedown.prevent）和真正的 blur
        let mentionBlurTimer = null;
        // 持久化 HTML 内容，因 contenteditable div 在 v-if 切步骤时会被销毁重建
        const promptHtml = ref('');
        // IME 中文输入法组合状态
        let isComposing = false;
        // 记录当前触发 @mention 弹窗的 contenteditable 元素
        // 用于 insertMention 精准定位，避免简易/专业/分镜混淆
        let activeMentionEl = null;
        // 标识当前触发 mention 弹窗的分镜 shot.id（-1 = 非分镜）
        const activeMentionShotId = ref(-1);

        /**
         * 将纯文本中的 @图片N 标记转换为带有 mention-chip span 的 HTML
         * 用于 AI 智能填充等场景回填含 @图片 引用的文本时，保持芯片交互功能正常
         * 纯文本部分会进行 HTML 转义防止 XSS，换行符转为 <br>
         */
        const promptTextToChipHtml = (text) => {
            if (!text) return '';
            // 先对纯文本做 HTML 转义（防止 AI 返回的文本包含特殊字符导致 XSS）
            const escapeHtml = (str) => str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            // 匹配 @图片 后跟数字的模式
            const mentionRegex = /@图片(\d+)/g;
            let result = '';
            let lastIndex = 0;
            let match;
            while ((match = mentionRegex.exec(text)) !== null) {
                // 添加匹配之前的纯文本部分（转义后换行转 <br>）
                if (match.index > lastIndex) {
                    result += escapeHtml(text.substring(lastIndex, match.index)).replace(/\n/g, '<br>');
                }
                // 生成 mention-chip span
                const label = match[0]; // e.g. "@图片1"
                result += `<span class="mention-chip" contenteditable="false" data-mention="${escapeHtml(label)}">${escapeHtml(label)}</span>\u00A0`;
                lastIndex = match.index + match[0].length;
            }
            // 添加剩余文本
            if (lastIndex < text.length) {
                result += escapeHtml(text.substring(lastIndex)).replace(/\n/g, '<br>');
            }
            return result;
        };


        // 根据光标位置更新弹出框定位（相对于触发的 contenteditable 元素）
        const updateMentionPopupPos = (editableEl) => {
            try {
                const sel = window.getSelection();
                if (!sel || !sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                const caretRect = range.getBoundingClientRect();
                const parentRect = editableEl.getBoundingClientRect();
                // 弹出框显示在光标下方偏移，左侧对齐光标
                mentionPopupPos.value = {
                    top: caretRect.bottom - parentRect.top + 6,
                    left: Math.max(0, caretRect.left - parentRect.left),
                };
            } catch (_) {
                // 降级到左下默认位置
                mentionPopupPos.value = { top: 0, left: 12 };
            }
        };

        const onCompositionStart = () => { isComposing = true; };
        const onCompositionEnd = () => {
            isComposing = false;
            // 组合结束后统一同步一次
            syncPromptFromEditable();
        };

        // 列出所有已成功上传的参考图（url 非空），用于弹窗展示
        // 首尾帧模式下，将 tailFrameFirst/tailFrameLast 也纳入可引用列表
        const mentionImages = computed(() => {
            if (frameMode.value === 'dual' && isKlingV3Model.value) {
                const imgs = [];
                if (tailFrameFirst.value.url) {
                    imgs.push({ preview: tailFrameFirst.value.preview, url: tailFrameFirst.value.url, _tailLabel: '首帧' });
                }
                if (tailFrameLast.value.url) {
                    imgs.push({ preview: tailFrameLast.value.preview, url: tailFrameLast.value.url, _tailLabel: '尾帧' });
                }
                return imgs;
            }
            return refImages.value.filter(img => img.url);
        });

        /**
         * 从 contenteditable DOM 中提取纯文本，mention chip → @图片N
         * 同时将 innerHTML 保存到 promptHtml 以便步骤切换时恢复
         */
        const syncPromptFromEditable = () => {
            // 根据当前模式选择活跃的 contenteditable ref
            // v-if/v-else 会销毁非活跃模式的 DOM，所以只有一个 ref 有值
            const el = promptTextarea.value || proPromptTextarea.value;
            if (!el) return;
            promptHtml.value = el.innerHTML;

            let text = '';
            const walk = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    // 将不换行空格 (\u00A0) 转为普通空格
                    text += node.textContent.replace(/\u00A0/g, ' ');
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && node.classList.contains('mention-chip')) {
                        // 芯片节点 → 提取其 data-mention 属性作为纯文本标记
                        text += node.getAttribute('data-mention') || node.textContent;
                    } else if (node.tagName === 'BR') {
                        text += '\n';
                    } else {
                        // 块级元素（div/p）：新段落前追加换行，避免文本粘连
                        if ((node.tagName === 'DIV' || node.tagName === 'P') && text.length > 0 && !text.endsWith('\n')) {
                            text += '\n';
                        }
                        node.childNodes.forEach(walk);
                    }
                }
            };
            el.childNodes.forEach(walk);
            prompt.value = text;
        };

        /**
         * 监听 contenteditable 的 input 事件
         * 每次输入同步纯文本；检测 @ 字符触发弹窗
         * 检测 @ 字符触发弹窗（通用：记录当前触发元素）
         * 注意：IME 组合期间（isComposing=true）跳过处理，避免干扰中文输入法
         */
        const onPromptInput = (e) => {
            if (isComposing) return;
            syncPromptFromEditable();

            // 记录当前触发输入的 contenteditable 元素
            const currentEl = e && e.target ? e.target : (promptTextarea.value || proPromptTextarea.value);

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount || !sel.isCollapsed) return;

            const range = sel.getRangeAt(0);
            const node = range.startContainer;

            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const offset = range.startOffset;
                const charBefore = offset > 0 ? text.charAt(offset - 1) : '';

                if (charBefore === '@') {
                    mentionActiveIdx.value = 0;
                    showMentionPopup.value = true;
                    activeMentionEl = currentEl;
                    activeMentionShotId.value = -1;
                    updateMentionPopupPos(currentEl);
                    return;
                }

                if (showMentionPopup.value) {
                    const beforeCursor = text.substring(0, offset);
                    if (beforeCursor.lastIndexOf('@') < 0) {
                        showMentionPopup.value = false;
                        activeMentionEl = null;
                    }
                }
            } else if (showMentionPopup.value) {
                showMentionPopup.value = false;
                activeMentionEl = null;
            }
        };

        /**
         * 分镜补充画面指令的 input 事件处理器
         * 与 onPromptInput 类似，但同步分镜的 supplement 字段，并设置 activeMentionShotId
         */
        const onShotSupplementInput = (e, shot) => {
            if (isComposing) return;

            // 从 contenteditable 提取纯文本同步到 shot.supplement（同 syncPromptFromEditable 逻辑）
            const el = e.target;
            if (el) {
                let text = '';
                const walk = (node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        text += node.textContent.replace(/\u00A0/g, ' ');
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList && node.classList.contains('mention-chip')) {
                            text += node.getAttribute('data-mention') || node.textContent;
                        } else if (node.tagName === 'BR') {
                            text += '\n';
                        } else {
                            node.childNodes.forEach(walk);
                        }
                    }
                };
                el.childNodes.forEach(walk);
                shot.supplement = text;
            }

            // 检测 @ 触发弹窗
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
            const range = sel.getRangeAt(0);
            const node = range.startContainer;

            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const offset = range.startOffset;
                const charBefore = offset > 0 ? text.charAt(offset - 1) : '';
                if (charBefore === '@') {
                    mentionActiveIdx.value = 0;
                    showMentionPopup.value = true;
                    activeMentionEl = el;
                    activeMentionShotId.value = shot.id;
                    updateMentionPopupPos(el);
                    return;
                }
                if (showMentionPopup.value && activeMentionShotId.value === shot.id) {
                    const beforeCursor = text.substring(0, offset);
                    if (beforeCursor.lastIndexOf('@') < 0) {
                        showMentionPopup.value = false;
                        activeMentionEl = null;
                        activeMentionShotId.value = -1;
                    }
                }
            } else if (showMentionPopup.value && activeMentionShotId.value === shot.id) {
                showMentionPopup.value = false;
                activeMentionEl = null;
                activeMentionShotId.value = -1;
            }
        };

        /**
         * 监听 keydown 事件：弹窗打开时拦截 ↑↓/Enter/Esc 用于导航
         */
        const onPromptKeydown = (e) => {
            if (!showMentionPopup.value) return;

            const imageCount = mentionImages.value.length;
            if (imageCount === 0) {
                if (e.key === 'Escape') {
                    showMentionPopup.value = false;
                    e.preventDefault();
                }
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    mentionActiveIdx.value = (mentionActiveIdx.value + 1) % imageCount;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    mentionActiveIdx.value = (mentionActiveIdx.value - 1 + imageCount) % imageCount;
                    break;
                case 'Enter':
                    e.preventDefault();
                    insertMention(mentionActiveIdx.value);
                    break;
                case 'Escape':
                    e.preventDefault();
                    showMentionPopup.value = false;
                    break;
            }
        };

        /**
         * 在 contenteditable 中插入 @图片N 芯片标签
         * 1. 删除光标前的 @ 字符（及之后的过滤文本）
         * 2. 插入 contenteditable="false" 的 <span> 芯片（浏览器原生支持整块删除）
         * 3. 在芯片后追加空格确保光标可正常定位
         */
        const insertMention = (mentionIdx) => {
            // 使用记录的触发元素，回退到主提示词元素
            const el = activeMentionEl || promptTextarea.value || proPromptTextarea.value;
            if (!el) return;

            const targetImg = mentionImages.value[mentionIdx];
            if (!targetImg) return;
            // 首尾帧模式下使用 _tailLabel（@首帧/@尾帧），普通模式使用 @图片N
            let label;
            if (targetImg._tailLabel) {
                label = `@${targetImg._tailLabel}`;
            } else {
                const realIdx = refImages.value.indexOf(targetImg);
                label = `@图片${realIdx + 1}`;
            }

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            const node = range.startContainer;

            // 在当前文本节点中找到 @ 并删除 @ 到光标之间的文本
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const offset = range.startOffset;
                const beforeCursor = text.substring(0, offset);
                const atIdx = beforeCursor.lastIndexOf('@');

                if (atIdx >= 0) {
                    // 拆分文本节点：@ 之前的部分 + 光标之后的部分
                    node.textContent = text.substring(0, atIdx) + text.substring(offset);
                    range.setStart(node, atIdx);
                    range.collapse(true);
                }
            }

            // 创建芯片元素
            const chip = document.createElement('span');
            chip.className = 'mention-chip';
            chip.contentEditable = 'false';
            chip.setAttribute('data-mention', label);
            chip.textContent = label;

            // 插入芯片
            range.insertNode(chip);

            // 在芯片后插入空格，作为后续输入的文本节点锚点
            const spacer = document.createTextNode('\u00A0');
            if (chip.nextSibling) {
                chip.parentNode.insertBefore(spacer, chip.nextSibling);
            } else {
                chip.parentNode.appendChild(spacer);
            }

            // 关键：光标必须放在 spacer 文本节点【内部】末尾（而非节点之后的间隙）
            // setStartAfter(spacer) → 光标在两个 DOM 节点之间的"缝隙"，IME 无法识别文本上下文
            // setStart(spacer, length) → 光标在文本节点内部，IME 可正常启动中文组合输入
            const newRange = document.createRange();
            newRange.setStart(spacer, spacer.length);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            showMentionPopup.value = false;
            activeMentionEl = null;
            syncPromptFromEditable();
        };

        /**
         * 粘贴拦截：只允许粘贴纯文本，防止带入外部 HTML 格式
         */
        const onPromptPaste = (e) => {
            e.preventDefault();
            const text = e.clipboardData?.getData('text/plain') || '';
            if (text) {
                document.execCommand('insertText', false, text);
                syncPromptFromEditable();
            }
        };

        /**
         * 失焦延迟关闭弹窗（给 mousedown.prevent 点击弹窗选项留时间）
         */
        const hideMentionPopupDelay = () => {
            mentionBlurTimer = setTimeout(() => {
                showMentionPopup.value = false;
                activeMentionEl = null;
                activeMentionShotId.value = -1;
            }, 200);
        };

        // 步骤切回第1步时恢复 contenteditable 的 HTML 内容（因 v-if 销毁了 DOM）
        watch(currentStep, (newStep) => {
            if (newStep === 1 && promptHtml.value) {
                nextTick(() => {
                    // 简易模式恢复
                    if (promptTextarea.value) {
                        promptTextarea.value.innerHTML = promptHtml.value;
                    }
                    // 专业模式恢复
                    if (proPromptTextarea.value) {
                        proPromptTextarea.value.innerHTML = promptHtml.value;
                    }
                });
            }
        });

        // 切换模式时同步 contenteditable 的 HTML 内容
        watch(pageMode, () => {
            if (promptHtml.value) {
                nextTick(() => {
                    if (promptTextarea.value) promptTextarea.value.innerHTML = promptHtml.value;
                    if (proPromptTextarea.value) proPromptTextarea.value.innerHTML = promptHtml.value;
                });
            }
        });

        // ==================== STEP 1 → STEP 2: Generate Script ====================
        const prompt = ref('');
        const isGeneratingScript = ref(false);
        const scriptContent = ref('');

        const generateScript = async () => {
            if (!prompt.value.trim()) {
                showToast('请输入文本内容（核心产品卖点）', 'error');
                return;
            }
            if (!hasRefImage.value) {
                showToast('请上传产品参考图', 'error');
                return;
            }
            if (!currentPromptModel.value) {
                showToast('请选择脚本模型', 'error');
                return;
            }
            if (isGeneratingScript.value) return;

            isGeneratingScript.value = true;
            currentStep.value = 2; // show step 2 with loading state inside editor

            try {
                // Backend will use the system_prompt configured in the admin panel for this model.

                let userMessage = prompt.value;

                // If there's a reference image, mention it
                if (hasRefImage.value) {
                    userMessage += '\n\n（已上传产品参考图，请基于产品特征撰写脚本）';
                }

                const payload = {
                    prompt: userMessage,
                    model: currentPromptModel.value,
                    video_duration: videoDuration.value || '8', // Pass to backend for placeholder replacement
                    text_only: true,
                };

                // Script generation: always only send the FIRST image
                if (firstImageUrl.value) {
                    payload.image_urls = [firstImageUrl.value];
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
                    // Extract text result
                    const text = json.data.result_text || json.data.text || '';
                    if (text) {
                        scriptContent.value = text;
                        currentStep.value = 2;
                        // 用户已成功到达过第 2 步，后续可直接点击步骤 2 跳回
                        if (maxStepReached.value < 2) maxStepReached.value = 2;
                        showToast('脚本生成成功！请审阅并确认', 'success');
                    } else {
                        showToast('未能获取到脚本内容，请重试', 'error');
                        currentStep.value = 1;
                    }
                } else {
                    let errMsg = json.msg || '脚本生成失败';
                    showToast(errMsg, 'error');
                    currentStep.value = 1;
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    showToast('脚本生成超时，请稍后重试', 'error');
                } else {
                    showToast('网络错误', 'error');
                }
                currentStep.value = 1;
            } finally {
                isGeneratingScript.value = false;
            }
        };

        // ==================== STEP 2 → STEP 3: Confirm & Render ====================
        const isGenerating = ref(false);
        const renderVideoUrl = ref('');
        const renderTaskId = ref('');

        const confirmAndRender = async () => {
            // ── 判断是否为首尾帧模式（与分镜模式互斥） ──
            // 可灵 API 文档: multi_shot=true 时不支持 image/image_tail 首尾帧功能，两者互斥
            const isDualFrameMode = pageMode.value === 'pro' && isKlingV3Model.value && frameMode.value === 'dual';

            // 分镜模式下不依赖 scriptContent（prompt 由后端从分镜中组装）
            // 首尾帧模式与分镜模式互斥，当使用首尾帧时强制关闭分镜模式
            const isMultiShotMode = !isDualFrameMode && pageMode.value === 'pro' && useMultiShot.value && isKlingV3Model.value;

            // 校验输入内容
            if (isDualFrameMode) {
                // 首尾帧模式：必须上传首帧图，且需要有提示词
                if (!tailFrameFirst.value.url) {
                    showToast('请上传首帧图片', 'error');
                    return;
                }
                if (!prompt.value.trim() && !scriptContent.value.trim()) {
                    showToast('请输入主体描述或生成脚本', 'error');
                    return;
                }
            } else if (!isMultiShotMode && !scriptContent.value.trim()) {
                showToast('请确认脚本内容', 'error');
                return;
            }
            if (isGenerating.value) return;

            isGenerating.value = true;

            try {
                // Determine how many images this video model accepts
                const videoModelMaxImages = currentModelObj.value?.capabilities?.max_upload_images || 0;

                // Slice the uploaded images according to the video model's max
                let imagesToSend = allRefImageUrls.value;
                if (videoModelMaxImages > 0 && imagesToSend.length > videoModelMaxImages) {
                    imagesToSend = imagesToSend.slice(0, videoModelMaxImages);
                }

                // 专业模式非分镜场景：使用 buildVideoPrompt() 生成简洁的视频提示词
                // 不再使用 scriptContent（buildStoryPrompt 的输出），因为其中包含面向提示词AI的
                // 结构化元指令（如标题、分隔符等），不适合直接发送给视频生成模型
                const isProNonMultiShot = pageMode.value === 'pro' && !isMultiShotMode;
                let videoPrompt;
                if (isMultiShotMode) {
                    videoPrompt = prompt.value || '分镜模式生成';
                } else if (isProNonMultiShot) {
                    videoPrompt = buildVideoPrompt();
                } else {
                    videoPrompt = scriptContent.value;
                }

                const payload = {
                    prompt: videoPrompt,
                    model: currentModel.value,
                    resolution: '1K',
                    video_resolution: videoResolution.value,
                    video_duration: videoDuration.value,
                    ratio: videoRatio.value,
                    count: 1,
                    generate_audio: generateAudio.value,
                    draft: isDraft.value,
                };

                // 如果模型使用 mode（标准/高品质）而非 resolution
                if (videoModes.value.length > 0) {
                    payload.video_mode = videoMode.value;
                }

                // 声音开关（仅对支持用户选择声音的模型传递，如 kling-v2-6）
                if (showSoundToggle.value) {
                    payload.sound_enabled = soundEnabled.value;
                }

                // Send ALL reference images (up to model's limit) for video generation
                if (imagesToSend.length > 0) {
                    payload.reference_image_urls = imagesToSend;
                    // Also set first_frame_url to the first image for backward compatibility
                    payload.first_frame_url = imagesToSend[0];
                }

                // ── 首尾帧模式：覆盖首帧图片并传递尾帧图片 ──
                // 可灵 API 文档: image_tail 与 multi_shot 互斥，首尾帧模式下不传分镜相关参数
                if (isDualFrameMode) {
                    // 显式标记不使用分镜模式，确保后端不会设置 multi_shot/shot_type/multi_prompt
                    payload.use_multi_shot = false;

                    // 首帧：使用 tailFrameFirst（覆盖原有的 reference_image_urls / first_frame_url）
                    if (tailFrameFirst.value.url) {
                        payload.first_frame_url = tailFrameFirst.value.url;
                        payload.reference_image_urls = [tailFrameFirst.value.url];
                    }
                    // 尾帧：新增 last_frame_url 参数（后端映射为 image_tail）
                    if (tailFrameLast.value.url) {
                        payload.last_frame_url = tailFrameLast.value.url;
                    }
                }
                // ── 分镜模式：传递结构化分镜数据给后端（仅 kling-v3 专业模式） ──
                if (isMultiShotMode) {
                    payload.use_multi_shot = true;

                    // 收集全局视频参数维度（画面风格、光影氛围、画质增强等 show_in_video=1）
                    const videoDimsData = {};
                    videoDimensions.value.forEach(dim => {
                        const selectedId = dimensionSelections.value[dim.id];
                        if (selectedId) {
                            const opt = dim.options?.find(o => o.id === selectedId);
                            if (opt) {
                                videoDimsData[dim.name] = {
                                    label: opt.label,
                                    prompt_text: opt.prompt_text || '',
                                };
                            }
                        }
                    });
                    payload.video_dimensions = videoDimsData;

                    // 收集各分镜的结构化数据
                    payload.shots = shots.value.map((shot, i) => {
                        const shotData = {
                            index: i + 1,
                            duration: String(shot.duration || 0),
                            description: shot.description || '',
                            camera_desc: shot.cameraDesc || '',
                            action: shot.action || '',
                            supplement: shot.supplement || '',
                        };

                        // 收集分镜维度（镜头视角、镜头运动方向等 show_in_storyboard=1）
                        const storyDimsData = {};
                        storyboardDimensions.value.forEach(dim => {
                            const optId = shot.dimSelections?.[dim.id];
                            if (optId) {
                                const opt = dim.options?.find(o => o.id === optId);
                                if (opt) {
                                    storyDimsData[dim.name] = {
                                        label: opt.label,
                                        prompt_text: opt.prompt_text || '',
                                    };
                                }
                            }
                        });
                        shotData.storyboard_dimensions = storyDimsData;

                        return shotData;
                    });
                }

                // ── 专业模式：保存脚本数据用于后续「脚本复刻」 ──
                if (pageMode.value === 'pro') {
                    const proData = {
                        page_mode: 'pro',
                        prompt: prompt.value,
                        core_action: coreAction.value,
                        scene_environment: sceneEnvironment.value,
                        shot_strategy: shotStrategy.value,
                        use_multi_shot: useMultiShot.value,
                        video_duration: videoDuration.value,
                        video_ratio: videoRatio.value,
                        video_mode: videoMode.value,
                        sound_enabled: soundEnabled.value,
                        ref_image_urls: allRefImageUrls.value,
                    };
                    // 全局视频参数维度选择（ID → ID 映射，用于回填）
                    const dimSelMap = {};
                    videoDimensions.value.forEach(dim => {
                        const selId = dimensionSelections.value[dim.id];
                        if (selId) dimSelMap[dim.id] = selId;
                    });
                    proData.dimension_selections = dimSelMap;
                    // 分镜数据（包含维度选择 ID）
                    proData.shots = shots.value.map((shot, i) => ({
                        description: shot.description || '',
                        camera_desc: shot.cameraDesc || '',
                        action: shot.action || '',
                        supplement: shot.supplement || '',
                        duration: shot.duration || 0,
                        dim_selections: shot.dimSelections ? { ...shot.dimSelections } : {},
                    }));
                    payload.pro_mode_data = proData;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 600000);

                currentStep.value = 3;
                // 用户已成功到达过第 3 步，后续可直接点击步骤 3 跳回
                if (maxStepReached.value < 3) maxStepReached.value = 3;
                renderVideoUrl.value = '';

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
                    userCredits.value = json.data.credits_balance;

                    if (json.data.async) {
                        showToast(`任务已提交！消耗 ${json.data.credits_cost} 积分，视频渲染中...`, 'success');
                        renderTaskId.value = json.data.task_id || '';
                        await loadHistory();
                        startPolling();
                    } else {
                        showToast(`生成成功！消耗 ${json.data.credits_cost} 积分`, 'success');
                        // Try to get video URL from response
                        if (json.data.url) {
                            renderVideoUrl.value = json.data.url;
                        } else if (json.data.items && json.data.items.length > 0) {
                            renderVideoUrl.value = json.data.items[0].url;
                        } else if (json.data.images && json.data.images.length > 0) {
                            renderVideoUrl.value = json.data.images[0];
                        }
                        await loadHistory();
                    }
                } else {
                    showToast(json.msg || '视频生成失败', 'error');
                    currentStep.value = 2; // go back to step 2
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    showToast('生成超时，请稍后重试', 'error');
                } else {
                    showToast('网络错误', 'error');
                }
                currentStep.value = 2;
            } finally {
                isGenerating.value = false;
            }
        };

        // ==================== STEP 3 ACTIONS ====================
        const goBackToStep1 = () => {
            // Go back to step 1, preserving all data
            currentStep.value = 1;
        };

        const regenerateVideo = () => {
            if (isGenerating.value) return;
            confirmAndRender();
        };

        const createNewVideo = () => {
            // Clear everything and go to step 1
            prompt.value = '';
            promptHtml.value = '';
            scriptContent.value = '';
            renderVideoUrl.value = '';
            renderTaskId.value = '';
            refImages.value = [];
            currentStep.value = 1;
            // 新流程需要重新从第 1 步开始走
            maxStepReached.value = 1;
        };

        const downloadVideo = () => {
            if (!renderVideoUrl.value) return;
            const a = document.createElement('a');
            a.href = renderVideoUrl.value;
            a.download = 'video_' + Date.now() + '.mp4';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        // ==================== ASYNC TASK POLLING ====================
        let pollTimer = null;
        const hasPendingTasks = ref(false);

        const startPolling = () => {
            if (pollTimer) return;
            hasPendingTasks.value = true;
            pollTimer = setInterval(async () => {
                try {
                    const res = await fetch('/api/task/poll', { headers: authHeaders });
                    const json = await res.json();
                    if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                    if (json.code === 200) {
                        const tasks = json.data || [];
                        let hasChanges = false;

                        for (const task of tasks) {
                            if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'expired') {
                                hasChanges = true;
                                if (task.status === 'succeeded') {
                                    showToast('🎬 视频渲染完成！', 'success');
                                    if (task.video_url) {
                                        renderVideoUrl.value = task.video_url;
                                    } else if (task.images && task.images.length > 0) {
                                        renderVideoUrl.value = task.images[0];
                                    }
                                } else {
                                    showToast(`视频渲染失败: ${task.error || '未知错误'}`, 'error');
                                }
                            }
                        }

                        if (json.credits !== undefined) {
                            userCredits.value = json.credits;
                        }

                        if (hasChanges) {
                            await loadHistory();
                            // Try to get video URL from history if not set
                            if (!renderVideoUrl.value && currentStep.value === 3 && historyList.value.length > 0) {
                                const latestItem = historyList.value[0];
                                if (latestItem.images && latestItem.images.length > 0 && isVideoUrl(latestItem.images[0])) {
                                    renderVideoUrl.value = latestItem.images[0];
                                }
                            }
                        }

                        if (!json.has_pending) {
                            // 竞态修复：回调可能先于轮询完成，导致后端已无 pending 记录，
                            // 但前端 renderVideoUrl 仍为空（轮询未捕获到 succeeded 状态变化）。
                            // 此时需要刷新历史记录，从最新成功记录中补全视频 URL。
                            if (!renderVideoUrl.value && currentStep.value === 3) {
                                await loadHistory();
                                if (historyList.value.length > 0) {
                                    const latestItem = historyList.value[0];
                                    if (latestItem.images && latestItem.images.length > 0 && isVideoUrl(latestItem.images[0])) {
                                        renderVideoUrl.value = latestItem.images[0];
                                        showToast('🎬 视频渲染完成！', 'success');
                                    }
                                }
                            }
                            stopPolling();
                        }
                    }
                } catch (e) {
                    console.error('轮询失败', e);
                }
            }, 10000);
        };

        const stopPolling = () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            hasPendingTasks.value = false;
        };

        // ==================== HISTORY ====================
        const historyList = ref([]);

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

        const mapHistoryItem = (item) => {
            const isStatusPending = item.status === 0;
            // 如果 status=0 但创建时间超过 30 分钟，视为已超时（不再显示转圈）
            let isPending = isStatusPending;
            let isTimeout = false;
            if (isStatusPending && item.create_time) {
                const createTs = typeof item.create_time === 'number' ? item.create_time * 1000 : new Date(item.create_time).getTime();
                const elapsed = Date.now() - createTs;
                if (elapsed > 30 * 60 * 1000) {
                    isPending = false;
                    isTimeout = true;
                }
            }
            return {
                groupId: item.group_id,
                id: item.first_id,
                prompt: item.prompt,
                model: item.model,
                originalImages: parseOriginalImages(item.original_image),
                images: item.images || [],
                resultText: item.result_text || null,
                time: item.create_time || '',
                creditsCost: item.credits_cost || 0,
                isDraft: item.is_draft === 1,
                seed: item.seed || 0,
                taskId: item.task_id || '',
                status: item.status || 1,
                isPending,
                isTimeout,
                proModeData: item.pro_mode_data || null,
                recordId: item.first_id || 0,
            };
        };

        const loadHistory = async () => {
            try {
                const res = await fetch('/api/history?page=1&page_size=20&type=video', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200 && json.data) {
                    historyList.value = json.data.map(mapHistoryItem);
                }
            } catch (e) { console.error('加载历史失败', e); }
        };

        // View history item
        const textDetailModal = ref({ show: false, title: '', content: '', prompt: '', videos: [], proModeData: null, recordId: 0, isShared: false, shareLoading: false });
        const previewUrl = ref(null);
        const previewType = ref('image');

        const isVideoUrl = (url) => {
            if (!url) return false;
            return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
        };

        const previewMedia = (url) => {
            if (!url) return;
            previewType.value = isVideoUrl(url) ? 'video' : 'image';
            previewUrl.value = url;
        };

        const viewHistoryItem = async (item) => {
            textDetailModal.value = {
                show: true,
                title: item.isPending ? '生成中...' : (item.prompt || '详情'),
                prompt: item.prompt || '',
                content: item.resultText || '',
                videos: item.images || [],
                proModeData: item.proModeData || null,
                recordId: item.recordId || 0,
                isShared: false,
                shareLoading: false,
            };
            // 异步检查是否已分享到星影共创
            if (item.recordId) {
                try {
                    const res = await fetch('/api/showcase/check', {
                        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ record_ids: [item.recordId] }),
                    });
                    const json = await res.json();
                    if (json.code === 200 && Array.isArray(json.data)) {
                        textDetailModal.value.isShared = json.data.includes(item.recordId);
                    }
                } catch (e) { /* 静默 */ }
            }
        };

        /**
         * 脚本复刻：从历史记录中恢复专业模式步骤1的所有数据
         * 仅当 proModeData 不为空时（即专业模式生成的记录）可用
         */
        const scriptReplicate = () => {
            const data = textDetailModal.value.proModeData;
            if (!data) {
                showToast('该记录没有可复刻的脚本数据', 'error');
                return;
            }

            // 关闭弹窗
            textDetailModal.value.show = false;

            // 切换到专业模式
            pageMode.value = 'pro';

            // 回填核心创意设定
            prompt.value = data.prompt || '';
            coreAction.value = data.core_action || '';
            sceneEnvironment.value = data.scene_environment || '';

            // 回填 contenteditable 的主体描述（同步 innerHTML）
            Vue.nextTick(() => {
                const el = proPromptTextarea.value || promptTextarea.value;
                if (el) {
                    el.innerText = prompt.value;
                }
            });

            // 回填视频参数
            if (data.video_duration) videoDuration.value = data.video_duration;
            if (data.video_ratio) videoRatio.value = data.video_ratio;
            if (data.video_mode) videoMode.value = data.video_mode;
            if (typeof data.sound_enabled === 'boolean') soundEnabled.value = data.sound_enabled;
            if (typeof data.use_multi_shot === 'boolean') useMultiShot.value = data.use_multi_shot;
            if (data.shot_strategy) shotStrategy.value = data.shot_strategy;

            // 回填全局视频参数维度选择
            if (data.dimension_selections) {
                Object.entries(data.dimension_selections).forEach(([dimId, optId]) => {
                    dimensionSelections.value[parseInt(dimId)] = parseInt(optId);
                });
            }

            // 回填参考图片（如果有保存的 URL）
            if (data.ref_image_urls && data.ref_image_urls.length > 0) {
                refImages.value = data.ref_image_urls.map(url => ({
                    preview: url,
                    url: url,
                }));
            }

            // 回填分镜数据
            if (data.shots && data.shots.length > 0) {
                shots.value = data.shots.map((s, i) => ({
                    id: i + 1,
                    description: s.description || '',
                    cameraDesc: s.camera_desc || '',
                    action: s.action || '',
                    supplement: s.supplement || '',
                    duration: s.duration || 0,
                    cameraAngle: '',
                    cameraMovement: '',
                    collapsed: false,
                    _angleDropOpen: false,
                    _moveDropOpen: false,
                    dimSelections: {},
                    _dimDrops: {},
                }));

                // 回填分镜维度选择（需要在 shots 创建后设置）
                data.shots.forEach((s, i) => {
                    if (s.dim_selections && shots.value[i]) {
                        const converted = {};
                        Object.entries(s.dim_selections).forEach(([dimId, optId]) => {
                            converted[parseInt(dimId)] = parseInt(optId);
                        });
                        shots.value[i].dimSelections = converted;
                    }
                });

                // 重算分镜时长
                if (data.shot_strategy !== 'custom') {
                    recalcShotDurations();
                }
            }

            // 跳转到步骤1
            currentStep.value = 1;
            maxStepReached.value = 1;

            showToast('脚本已复刻到步骤1，可直接调整后重新生成', 'success');
        };

        /**
         * 分享/取消分享到星影共创
         */
        const toggleShowcaseShare = async () => {
            const modal = textDetailModal.value;
            if (!modal.recordId || modal.shareLoading) return;

            modal.shareLoading = true;
            try {
                if (modal.isShared) {
                    // 取消分享
                    const res = await fetch('/api/showcase/unshare', {
                        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ record_id: modal.recordId }),
                    });
                    const json = await res.json();
                    if (json.code === 200) {
                        modal.isShared = false;
                        showToast('已取消共创分享');
                    } else {
                        showToast(json.msg || '操作失败', 'error');
                    }
                } else {
                    // 分享
                    const res = await fetch('/api/showcase/share', {
                        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ record_id: modal.recordId }),
                    });
                    const json = await res.json();
                    if (json.code === 200) {
                        modal.isShared = true;
                        showToast('🌟 已分享到星影共创！');
                    } else {
                        showToast(json.msg || '分享失败', 'error');
                    }
                }
            } catch (e) {
                showToast('网络错误', 'error');
            } finally {
                modal.shareLoading = false;
            }
        };

        const formatDate = (ts) => {
            if (!ts) return '';
            let d;
            if (typeof ts === 'string' && ts.includes('-')) d = new Date(ts);
            else d = new Date(Number(ts) * 1000);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        const formatTime = (ts) => {
            if (!ts) return '';
            let d;
            if (typeof ts === 'string' && ts.includes('-')) d = new Date(ts);
            else d = new Date(Number(ts) * 1000);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        // ==================== COMMON ====================
        // Credit history modal (已迁移到公共组件)
        const showCreditModal = ref(false);
        const creditLogList = ref([]);
        const loadCreditLogs = async () => { };

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
                    const vids = json.data.filter(m => m.type === 'video');
                    if (vids.length > 0 && !currentModel.value) currentModel.value = vids[0].model_key;
                    // 默认选中第一个提示词模型
                    const prompts = json.data.filter(m => m.type === 'prompt');
                    if (prompts.length > 0 && !currentPromptModel.value) currentPromptModel.value = prompts[0].model_key;
                }
            } catch { }
        };

        const loadSiteConfig = async () => { };
        const refreshUser = async () => { };

        const checkPendingTasks = async () => {
            try {
                const res = await fetch('/api/task/poll', { headers: authHeaders });
                const json = await res.json();
                if (json.code === 401) { localStorage.clear(); window.location.href='/pages/login.html'; return; }
                if (json.code === 200) {
                    const tasks = json.data || [];
                    let hasChanges = false;

                    // 处理已完成/失败的任务（与轮询回调逻辑一致）
                    for (const task of tasks) {
                        if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'expired') {
                            hasChanges = true;
                            if (task.status === 'succeeded' && task.video_url) {
                                renderVideoUrl.value = task.video_url;
                            }
                        }
                    }

                    if (json.credits !== undefined) {
                        userCredits.value = json.credits;
                    }

                    // 有状态变更时刷新历史列表
                    if (hasChanges) {
                        await loadHistory();
                    }

                    // 仍有待处理任务时启动轮询
                    if (json.has_pending) {
                        startPolling();
                    }
                }
            } catch { }
        };

        // 自动均分监听：当视频总时长或分镜策略变化时重新计算
        watch([() => videoDuration.value, () => shotStrategy.value], () => {
            recalcShotDurations();
        });

        onMounted(async () => {
            loadModels();
            await loadHistory();
            checkPendingTasks();
            loadScriptDimensions();
            // 初始均分
            nextTick(() => recalcShotDurations());

            // 检查是否有来自「星影共创」的脚本复刻数据
            const showcaseData = sessionStorage.getItem('showcase_replicate');
            if (showcaseData) {
                sessionStorage.removeItem('showcase_replicate');
                try {
                    const data = JSON.parse(showcaseData);
                    if (data && data.page_mode === 'pro') {
                        // 延迟执行确保维度等数据已加载
                        setTimeout(() => {
                            // 复用 scriptReplicate 的回填逻辑（手动设置 textDetailModal 数据后调用）
                            textDetailModal.value.proModeData = data;
                            scriptReplicate();
                            // 清空参考图片，提示用户上传自己的产品图
                            refImages.value = [];
                            showToast('🌟 脚本已从星影共创复刻！请上传您的产品图', 'success');
                        }, 800);
                    }
                } catch (e) {
                    console.error('解析星影共创数据失败', e);
                }
            }
        });

        onUnmounted(() => {
            stopPolling();
        });

        // ==================== Asset Picker ====================
        const showAssetPicker = ref(false);
        const pickerTab = ref('local');
        const pickerDragging = ref(false);
        const pickerFileInput = ref(null);
        const pickerLoading = ref(false);
        const pickerAssetGroups = ref([]);
        const pickerSelectedUrls = ref([]);
        // 资产选择器的目标：'refImages' (默认多图上传)、'tailFirst' (首帧)、'tailLast' (尾帧)
        const assetPickerTarget = ref('refImages');

        const openAssetPicker = (target) => {
            assetPickerTarget.value = target || 'refImages';
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
            } catch { showToast('加载资产失败', 'error'); }
            finally { pickerLoading.value = false; }
        };

        const togglePickerAsset = (item) => {
            const idx = pickerSelectedUrls.value.indexOf(item.url);
            if (idx >= 0) {
                pickerSelectedUrls.value.splice(idx, 1);
            } else {
                const target = assetPickerTarget.value;
                // 首尾帧模式下每个槽位只能选 1 张
                if (target === 'tailFirst' || target === 'tailLast') {
                    if (pickerSelectedUrls.value.length >= 1) {
                        showToast('每个帧位只能选择 1 张图片', 'error');
                        return;
                    }
                } else {
                    // 原有逻辑：检查是否超出最大张数限制
                    const remaining = maxUploadImages.value - refImages.value.length;
                    if (pickerSelectedUrls.value.length >= remaining) {
                        showToast(`最多还能选择 ${remaining} 张`, 'error');
                        return;
                    }
                }
                pickerSelectedUrls.value.push(item.url);
            }
        };

        // 确认选择资产（资产已在服务器上，无需重新上传）
        const confirmPickerAssets = () => {
            const target = assetPickerTarget.value;
            if (target === 'tailFirst' || target === 'tailLast') {
                // 首尾帧模式：将选中的资产直接赋值到对应槽位
                const url = pickerSelectedUrls.value[0];
                if (url) {
                    const frameRef = target === 'tailFirst' ? tailFrameFirst : tailFrameLast;
                    frameRef.value = { preview: url, url: url };
                }
            } else {
                // 原有逻辑：追加到 refImages
                for (const url of pickerSelectedUrls.value) {
                    refImages.value.push({ preview: url, url: url });
                }
            }
            closeAssetPicker();
        };

        // 本地上传（弹窗内）
        const handlePickerLocalUpload = (e) => {
            const target = assetPickerTarget.value;
            if (target === 'tailFirst' || target === 'tailLast') {
                // 首尾帧模式：将选中文件上传到对应槽位
                tailFrameUploadTarget = target === 'tailFirst' ? 'first' : 'last';
                handleTailFrameUpload(e);
            } else {
                uploadRefImage(e);
            }
            closeAssetPicker();
        };

        // 拖拽上传
        const handlePickerDrop = (e) => {
            pickerDragging.value = false;
            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            const mockEvent = { target: { files, value: '' } };
            const target = assetPickerTarget.value;
            if (target === 'tailFirst' || target === 'tailLast') {
                tailFrameUploadTarget = target === 'tailFirst' ? 'first' : 'last';
                handleTailFrameUpload(mockEvent);
            } else {
                uploadRefImage(mockEvent);
            }
            closeAssetPicker();
        };

        return {
            toast, dismissToast, siteName, siteLogo,
            userName, userAvatar, userCredits, userRole, userInitial,
            currentStep,
            maxStepReached, goToStep,
            // Page mode
            pageMode,
            allModels, videoModels, currentModel, currentModelObj, currentModelCost, totalCost,
            promptModels, currentPromptModel, currentPromptModelObj,
            videoModelDropOpen, promptModelDropOpen,
            ratioDropOpen, resDropOpen, modeDropOpen, durationDropOpen, soundDropOpen,
            videoRatio, videoDuration, videoResolution, videoRatios, videoDurations, availableVideoResolutions,
            videoMode, videoModes, videoModeLabels,
            generateAudio, isDraft,
            // Multi-image upload
            maxUploadImages, refImages, frameUploading, canAddMoreImages,
            uploadRefImage, removeRefImage, hasRefImage,
            // @Mention feature (contenteditable)
            promptTextarea, showMentionPopup, mentionPopupPos, mentionActiveIdx, mentionImages, activeMentionShotId,
            onPromptInput, onPromptKeydown, insertMention, hideMentionPopupDelay, onPromptPaste,
            onShotSupplementInput, onCompositionStart, onCompositionEnd,
            prompt, isGeneratingScript, scriptContent, generateScript,
            isGenerating, renderVideoUrl, confirmAndRender,
            goBackToStep1, regenerateVideo, createNewVideo, downloadVideo,
            historyList, viewHistoryItem,
            previewUrl, previewType, previewMedia, isVideoUrl,
            textDetailModal,
            showCreditModal, creditLogList, loadCreditLogs,
            formatDate, formatTime,
            avatarInput, handleAvatarUpload, logout,
            onUserLoaded, onSiteLoaded,
            // Asset Picker
            showAssetPicker, pickerTab, pickerDragging, pickerFileInput,
            pickerLoading, pickerAssetGroups, pickerSelectedUrls,
            openAssetPicker, closeAssetPicker, loadPickerAssets,
            togglePickerAsset, confirmPickerAssets,
            handlePickerLocalUpload, handlePickerDrop,
            // Professional Mode
            coreAction, sceneEnvironment, isAiFilling, aiSmartFill,
            isSmartStoryboarding, aiSmartStoryboard, specifiedShotCount, maxShotCount, aiRefillShot,
            shotStrategy, shots, addShot, removeShot, updateShotDuration,
            getShotTimeRange, getShotAngleLabel, getShotMoveLabel,
            toggleShotDimDrop, getShotDimLabel, setShotDimSelection, getShotDimSelectedOpt,
            scriptDimensions, videoDimensions, storyboardDimensions, dimensionSelections, dimDropOpenMap,
            toggleDimDrop, getDimSelectedLabel, getDimSelectedOption, viewDimOptionImage,
            dimDetailModal, viewDimDetail, closeDimDetailModal,
            dimImageLightbox, closeDimImageLightbox, closeAllProDropdowns,
            cameraAngleOptions, cameraMoveOptions,
            proPromptTextarea, generateStoryboard,
            previewPrompt, promptPreviewModal, copyPreviewPrompt,
            // 分镜模式（可灵系列）
            useMultiShot, isKlingV3Model, isRatioLocked,
            // 声音开关（kling-v2-6 等模型）
            soundEnabled, showSoundToggle, soundOptions, soundLabels, soundDropOpen,
            // 首尾帧模式（kling-v3 专业模式）
            frameMode, tailFrameFirst, tailFrameLast, removeTailFrame,
            // 脚本复刻 & 星影共创
            scriptReplicate, toggleShowcaseShare,
        };
    }
});
app.component('app-header', AppHeaderComponent);
app.mount('#app');
