# 星骏跨境多模态 AI 工具箱

本仓库对应 `https://xjzn.xzbest.site/`。`https://daohan.xzbest.site/` 是独立导航站，本次整合无需更新它。

## 本地运行

双击 `start-local.bat`，打开窗口中显示的 `http://127.0.0.1:8899/`。也可运行 `npm start`。启动器检查路径、依赖、构建与服务状态，显示本机及局域网地址；保持窗口打开，Ctrl+C 停止。源码更新后会自动重新构建选品演示。

| 功能 | 路径 |
| --- | --- |
| 首页 | `/` |
| 图片生成 | `/pages/image.html` |
| 视频生成 | `/pages/video.html` |
| 退款看板 | `/refund/` |
| 深度退款分析 | `/refund/deep/` |
| AI 选品演示 | `/selection/` |

## AI 选品演示

沿用 `amazon-ai-selection-system` 的 React 工作台、统计逻辑与设计，通过 Vite 构建独立静态演示；完整源码位于 `selection-demo/`。不需要原始项目目录、后端进程或 API Key。

演示固定关键词为 `Womens Puff Long Sleeve Button Down Shirts`，锚点为 `B0FF9S1DVQ`。首屏 48 个商品，前三页共 144 个历史样本，采集时间为 2026-09-18。关键词证据来自历史真实验证，未覆盖表达显示数据不足；不能将历史结果当作本次实时验证。

从首页进入 AI 选品后：

1. 点击“开始选品”，再点击“读取演示样本”。
2. 保留默认选中的演示锚点，进入信息提取并点击提取按钮。
3. 进入竞品搜索，点击“一键提取前 3 页竞品”。
4. 进入关键词验证，点击“查看历史关键词验证”，再进入分析。
5. 查看分析报告、原图与历史改款图对比，可下载历史结果。

也可从总览直接观看演示报告。报告在当前浏览器标签会话中保存，刷新可恢复；顶部“重置演示”清除报告并返回起点。

本次报告统计按当前所选历史样本重新计算。改为深海军蓝色的图片来自已完成的历史真实任务，仅与该任务的原图和指令配对，未进行新颜色需求验证。人工修改锚点特征后重新分析，不会套用这张历史结果。

商品图片、案例 JSON 和改款图均已放入 `selection-demo/public/`，演示流程不调用实时采集、关键词或生图服务。商品原链接可作为参考手动打开。

## 退款页面

退款看板来源于 `returnyx/refund2`；深度分析来源于 `returnyx/shendutk/analysis.html`，保留原项目的示例数据与交互。这次仅整合展示，没有接入 ERP 真实退款数据。公共导航可切换两个页面并返回工具箱。

图表库和退款图标字体已本地化。旧的预编译退款应用保留在 `refund/legacy.html` 和 `refund/dist/`，原有 SSO 回调继续指向旧应用；首页退款入口使用新的示例看板。

## 发布到 Vercel

更新本仓库后，Vercel 项目使用仓库根目录。`vercel.json` 已配置：

- Framework Preset：Other（配置中的 `framework: null`）。
- Build Command：`npm run build`。
- Output Directory：`dist`。

构建会生成选品静态页面，并将首页、图片/视频页面、静态资源、退款页面和选品页面一起复制到 `dist/`。部署文件中不包含开发源码、`node_modules` 或本地环境变量。

选品演示不需要新增 Vercel 环境变量。原图片/视频 API 仍使用已有 `/api/*` 代理，退款旧应用仍使用 `/api/v1/*` 代理。实际发布后应检查四个首页入口，并按上述步骤演示一遍。当前任务没有替你发布到线上。

## 维护

- `npm run check`：检查选品演示的 TypeScript。
- `npm run build`：重新构建完整部署目录。
- 修改选品界面：编辑 `selection-demo/src/`；更新案例：编辑 `selection-demo/public/data/case.json` 及配套图片。
- 可选资料刷新：`node scripts/import-selection-data.js <原选品项目目录>`。此脚本只在维护时使用，读取历史记录并下载公开商品图；日常构建不依赖它。

来源与整合调整记录见 `LOCAL-DEVELOPMENT.md`。
