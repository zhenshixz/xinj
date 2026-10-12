import { analyzeProducts } from './analysis';
import type { AmazonProduct, AnalysisResult, KeywordCandidate, KeywordValidationResult, SearchResponse } from '@/types/product';

export const DEMO_QUERY = 'Womens Puff Long Sleeve Button Down Shirts';
export const DEMO_ANCHOR = 'B0FF9S1DVQ';
export type DemoJob = { id: string; status: string; prompt: string; createdAt: string; originalUrl: string; imageUrl: string; afterReview?: { decision: string } };
type Fixture = { query: string; pages: SearchResponse[]; anchor: AmazonProduct; keywordValidation: KeywordValidationResult; job: DemoJob };
let fixture: Promise<Fixture> | undefined;
export function loadCase() {
  fixture ??= fetch('/selection/data/case.json').then(async (response) => {
    if (!response.ok) throw new Error('演示资料加载失败，请刷新或检查站点部署文件');
    return response.json() as Promise<Fixture>;
  }).catch((error) => { fixture = undefined; throw error; });
  return fixture;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function historicalKeywords(data: Fixture, candidates: KeywordCandidate[]): KeywordValidationResult {
  const evidence = candidates.map((candidate) => {
    const match = data.keywordValidation.evidence.find((item) => item.keyword.toLowerCase() === candidate.keyword.toLowerCase());
    return match ? { ...match, candidateId: candidate.id, sourceLabels: candidate.sourceLabels } : {
      candidateId: candidate.id, keyword: candidate.keyword, sourceLabels: candidate.sourceLabels,
      status: 'no-data' as const, weeklySearchVolume: null, searchFrequencyRank: null, competitiveDifficulty: null,
      clickConversionRate: null, organicRotation: null, cpc: null, minSuggestedBid: null, maxSuggestedBid: null,
      topAsins: [], periodFrom: null, periodTo: null, assessment: '数据不足' as const,
      assessmentReason: '此表达没有历史验证记录，演示不补造数据。',
    };
  });
  return {
    ...data.keywordValidation, candidates, evidence, demandGroups: [], cached: true,
    status: evidence.some((item) => item.status === 'matched') ? 'partial' : 'failed',
    message: '历史真实关键词结果回放；未覆盖表达保留为数据不足，本次未请求实时验证。',
  };
}

function reportFor(data: Fixture, products: AmazonProduct[], anchors: AmazonProduct[], validation?: KeywordValidationResult): AnalysisResult {
  const report = analyzeProducts(data.query, products, anchors, validation);
  // Only pair the saved edited image with the original anchor and its actual instruction.
  if (anchors.length === 1 && anchors[0].asin === DEMO_ANCHOR && !Object.keys(anchors[0].featureCorrections ?? {}).length) {
    report.designProposals = [{
      id: '历史改款案例', product: anchors[0], category: '微调优化',
      sourceFeature: '原款颜色', targetFeature: '深海军蓝', targetFeatures: ['深海军蓝'],
      tags: ['颜色调整', '历史真实生图'], retainedFeatures: ['衣领', '袖型', '版型', '模特姿势', '背景'],
      reason: '回放已完成的原款改色测试，展示从选品判断到改款图对比的完整流程。',
      scenario: '历史真实改色案例演示', risk: '待核验',
      evidence: '原图与改款图来自同一历史任务；此颜色方向未进行需求验证。',
      evidenceLevel: 'hypothesis', action: data.job.prompt, keywordEvidence: null,
      suggestedPriceMin: anchors[0].price, suggestedPriceMax: anchors[0].price, demoJobId: data.job.id,
    }];
  }
  if (report.designProposals[0]?.demoJobId) {
    report.strategies = [{
      title: '先核验，再打样', subtitle: '历史改款案例 · 设计假设',
      body: '深海军蓝方向展示已完成的真实改色测试，不代表已验证市场需求。核对原图与结果的结构差异，再进行需求、打样和成本确认。',
      proposalIds: report.designProposals.map((item) => item.id), tone: 'neutral',
    }];
  }
  return report;
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const url = new URL(String(input), window.location.origin);
    const data = await loadCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === '/api/amazon/search') {
      if ((url.searchParams.get('q') ?? '').trim().toLowerCase() !== data.query.toLowerCase()) {
        return json({ error: `演示版支持固定案例：${DEMO_QUERY}。点击重置演示恢复。`, retryable: false }, 400);
      }
      const page = data.pages.find((item) => item.page === Number(url.searchParams.get('page') || 1));
      return page ? json({ ...page, cached: true }) : json({ error: '没有此页的演示资料', retryable: false }, 404);
    }
    if (url.pathname === '/api/amazon/product') {
      return url.searchParams.get('asin') === DEMO_ANCHOR
        ? json({ details: data.anchor.details })
        : json({ error: '此商品没有完整演示详情，请选择标注的演示锚点。', retryable: false }, 400);
    }
    if (url.pathname === '/api/keywords/validate') return json(historicalKeywords(data, body.candidates ?? []));
    if (url.pathname === '/api/demo/report') {
      const products = data.pages.flatMap((item) => item.products);
      return json({ analysis: reportFor(data, products, [data.anchor], data.keywordValidation), anchors: [data.anchor] });
    }
    if (url.pathname === '/api/analysis') {
      if (body.query !== data.query || !body.products?.length || body.anchors?.length !== 1 || body.anchors[0].asin !== DEMO_ANCHOR) {
        return json({ error: '请使用固定演示关键词并选择演示锚点，完成竞品采集后再分析。', retryable: false }, 400);
      }
      const allowed = new Set(data.pages.flatMap((page) => page.products.map((item) => item.asin)));
      const products = (body.products as AmazonProduct[]).filter((item) => allowed.has(item.asin));
      const anchors = body.anchors as AmazonProduct[];
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
          try {
            const started = performance.now();
            send({ type: 'stage', index: 0, status: 'running', processed: products.length, summary: '读取历史样本并校验 ASIN' });
            const report = reportFor(data, products, anchors, body.keywordValidation);
            const duration = Math.round(performance.now() - started);
            const summaries = [
              `${products.length} 条历史输入，去重为 ${report.productCount} 个商品`,
              `重新计算样本价格与公开需求信号，中位价 $${report.medianPrice ?? '--'}`,
              `读取 ${anchors.length} 个历史锚点详情，未执行实时采集`,
              `计算 ${report.priceBands.length} 个价格分布区间`,
              `汇总 ${report.attributeGroups.length} 组属性信号`,
              `对比演示锚点与 ${report.productCount} 个历史竞品`,
              '整理样本报告与历史改款案例，未执行新的 AI 生图',
            ];
            summaries.forEach((summary, index) => send({ type: 'stage', index, status: 'complete', processed: index === 2 ? anchors.length : report.productCount, summary, durationMs: index === 0 ? duration : 0 }));
            report.analysisMeta = {
              startedAt: new Date(Date.now() - duration).toISOString(), completedAt: new Date().toISOString(), durationMs: duration,
              method: '历史真实样本的浏览器统计；关键词验证与改款图为历史结果回放',
              stageTimings: summaries.map((summary, index) => ({ name: summary, summary, processed: report.productCount, durationMs: index === 0 ? duration : 0 })),
            };
            send({ type: 'result', result: report });
          } catch (error) { send({ type: 'error', error: error instanceof Error ? error.message : '演示分析失败' }); }
          finally { controller.close(); }
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
    }
    return json({ error: '演示版本未提供此功能', retryable: false }, 404);
  } catch (error) { return json({ error: error instanceof Error ? error.message : '演示资料读取失败', retryable: false }, 500); }
}
