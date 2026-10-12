import { useEffect, useState, type ReactNode } from 'react';
import type { AmazonProduct, DesignProposal } from '@/types/product';
import { loadCase, type DemoJob } from '@/lib/demo-api';
export function DesignImageEditor({ proposal, children, presetJobId }: { anchor: AmazonProduct; proposal: DesignProposal; reportId: string; children?: ReactNode; presetJobId?: string }) {
  const [job, setJob] = useState<DemoJob | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let stopped = false;
    if (presetJobId) loadCase().then((data) => { if (!stopped && data.job.id === presetJobId) setJob(data.job); }).catch(() => { if (!stopped) setError('历史改款图加载失败，请刷新重试。'); });
    return () => { stopped = true; };
  }, [presetJobId]);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);
  return <div className="design-image-editor">
    {job ? <div className="proposal-result">
      <button className="proposal-result-image" type="button" onClick={() => setExpanded(true)} aria-label="放大改款图并对比原图"><img src={job.imageUrl} alt="历史真实改款结果：深海军蓝衬衫" /></button>
      <span className="image-role-label">历史真实生图 · 非本次生成</span>
      <p className="proposal-result-description"><strong>本图改动：</strong>{job.prompt}</p>
      <div className="proposal-result-actions"><button type="button" className="secondary-button" onClick={() => setExpanded(true)}>与原图对比</button><a className="secondary-button" href={job.imageUrl} download="selection-demo-edit.png">下载历史改款图</a></div>
    </div> : <p className="proposal-result-description">{error || (presetJobId ? '正在读取历史改款图…' : '此方向为样本统计建议，未生成对应图片。')}</p>}
    {children}
    {expanded && job && <div className="image-compare-overlay" role="dialog" aria-modal="true" aria-label="历史改款对比">
      <button className="secondary-button" type="button" onClick={() => setExpanded(false)}>关闭对比</button>
      <div className="image-compare-equal"><figure><img src={job.originalUrl} alt="历史锚点原图" /><figcaption>锚点原图</figcaption></figure><figure><img src={job.imageUrl} alt="历史真实改款图" /><figcaption>历史生成结果 · 待人工确认</figcaption></figure></div><p>{job.prompt}</p>
    </div>}
  </div>;
}
