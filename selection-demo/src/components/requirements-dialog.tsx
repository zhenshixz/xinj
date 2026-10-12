export function RequirementsDialog({ step }: { step: number }) {
  return <aside className="demo-banner" aria-label="演示说明">
    <div><a href="/">← 星骏 AI 工具箱</a><strong>AI 选品 · 完整流程 DEMO</strong></div>
    <p>固定案例：女式泡泡袖长袖衬衫。搜索样本采集于 2026-09-18；关键词验证与改款图为历史真实结果回放。本次统计按所选样本计算。</p>
    <div><span>{step === 1 ? '请选择 B0FF9S1DVQ 演示锚点，已为你默认选中。' : '可逐步操作，也可直接查看报告；不支持任意关键词实时采集或现场生图。'}</span><a href="/selection/?restart=1">重置演示 ↻</a></div>
  </aside>;
}
