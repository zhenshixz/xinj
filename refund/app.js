let trendChart, reasonPieChart, dimBarChart, partDoughnutChart, regionBarChart;
let currentSkuData = null;

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    
    // UI Connections
    const searchBtn = document.getElementById('searchBtn');
    const skuInput = document.getElementById('skuInput');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Default Load
    loadData(skuInput.value.trim() || 'CW250221092');

    // Search Action
    searchBtn.addEventListener('click', () => {
        const query = skuInput.value.trim();
        if(!query) return;

        loadingOverlay.classList.remove('hidden');
        loadingOverlay.style.display = 'flex';
        
        setTimeout(() => {
            loadData(query);
            loadingOverlay.classList.add('hidden');
            setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
        }, 500);
    });

    // Window Resize
    window.addEventListener('resize', () => {
        trendChart && trendChart.resize();
        reasonPieChart && reasonPieChart.resize();
        dimBarChart && dimBarChart.resize();
        partDoughnutChart && partDoughnutChart.resize();
        regionBarChart && regionBarChart.resize();
    });

    // Dimension Tabs interaction
    const dimTabs = document.querySelectorAll('#dimTabs .pill');
    dimTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            dimTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            renderDimBarChart(currentSkuData, e.target.dataset.type);
        });
    });

    // Doc Modal Logic
    const docBtn = document.getElementById('docBtn');
    const docModal = document.getElementById('docModal');
    const closeDocBtn = document.getElementById('closeDocBtn');

    if (docBtn && docModal && closeDocBtn) {
        docBtn.addEventListener('click', () => {
            docModal.classList.remove('hidden');
        });

        closeDocBtn.addEventListener('click', () => {
            docModal.classList.add('hidden');
        });

        // Close on overlay click
        docModal.addEventListener('click', (e) => {
            if (e.target === docModal) {
                docModal.classList.add('hidden');
            }
        });
    }

    // Image Modal Logic
    const productImage = document.getElementById('productImage');
    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = document.getElementById('closeImageModalBtn');
    const enlargedImg = document.getElementById('enlargedImg');

    if (productImage && imageModal && closeImageModalBtn) {
        productImage.addEventListener('click', () => {
            enlargedImg.src = productImage.src;
            imageModal.classList.remove('hidden');
        });
        closeImageModalBtn.addEventListener('click', () => {
            imageModal.classList.add('hidden');
        });
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.classList.add('hidden');
            }
        });
    }

    // Linkage logic for reasonPieChart
    reasonPieChart.on('click', (params) => {
        const reason = params.name;
        document.getElementById('partTitleText').innerHTML = `退款原因聚类分析 (已筛选: <span style="color:var(--primary);">${reason}</span>) <a href="#" id="resetPartFilterBtn" style="font-size:12px; margin-left: 8px; color:var(--text-muted); font-weight:normal;">清除筛选</a>`;
        
        // attach reset listener
        document.getElementById('resetPartFilterBtn').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('partTitleText').innerHTML = `退款原因聚类分析 (商品部位)`;
            renderPartDoughnut(currentSkuData);
        });

        // Simulate linkage by modifying the data visibly
        const simulatedData = { ...currentSkuData };
        simulatedData.partCluster = currentSkuData.partCluster.map(item => ({
            ...item, 
            value: Math.max(10, Math.floor(Math.random() * 80))
        }));
        renderPartDoughnut(simulatedData);
    });
});

function initCharts() {
    trendChart = echarts.init(document.getElementById('trendChart'));
    reasonPieChart = echarts.init(document.getElementById('reasonPieChart'));
    dimBarChart = echarts.init(document.getElementById('dimBarChart'));
    partDoughnutChart = echarts.init(document.getElementById('partDoughnutChart'));
    regionBarChart = echarts.init(document.getElementById('regionBarChart'));
}

function loadData(skuId) {
    const data = MOCK_DATA[skuId];
    if (!data) {
        alert("未找到该款号，建议输入：CW250221092, XJCW2521047, XJCW240921516");
        return;
    }
    currentSkuData = data;

    // 1. Base Profiling
    document.getElementById('productImage').src = data.base.image;
    document.getElementById('productSku').textContent = data.base.sku;
    document.getElementById('designLead').textContent = data.base.designLead;
    document.getElementById('opsLead').textContent = data.base.opsLead;

    // Tags
    const tagsContainer = document.getElementById('productTags');
    tagsContainer.innerHTML = '';
    data.base.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'badge badge-gray';
        span.textContent = `${tag.label}: ${tag.value}`;
        tagsContainer.appendChild(span);
    });

    // Metrics
    const salesNum = parseInt(data.metrics.sales.replace(/,/g, ''), 10);
    const returnsNum = parseInt(data.metrics.returns.replace(/,/g, ''), 10);
    const rate = ((returnsNum / salesNum) * 100).toFixed(1);
    
    document.getElementById('returnRate').textContent = rate + '%';
    document.getElementById('totalSales').textContent = data.metrics.sales;
    document.getElementById('returnCount').textContent = data.metrics.returns;

    // 2. Refresh Graphics
    renderTrendChart(data);
    renderPieChart(data);

    // Render dim bar (default color)
    renderDimBarChart(data, 'color');

    // Part Cluster
    renderPartDoughnut(data);
    renderPartComments(data);

    // Region Ranking
    renderRegionBarChart(data);

    // 3. AI Advices
    renderAiAdvice(data);
}

// ------------------------------------
// UI Render Helpers
// ------------------------------------

function renderAiAdvice(data) {
    const container = document.getElementById('aiAdviceCards');
    container.innerHTML = `
        <div class="advice-col">
            <h4><span class="material-symbols-outlined text-orange">format_color_fill</span> 颜色问题诊断</h4>
            <p>${data.aiColorAdvice}</p>
        </div>
        <div class="advice-col">
            <h4><span class="material-symbols-outlined text-green">straighten</span> 尺码分层诊断</h4>
            <p>${data.aiSizeAdvice}</p>
        </div>
        <div class="advice-col">
            <h4><span class="material-symbols-outlined text-red">build</span> 部位痛点决策</h4>
            <p>${data.aiPartAdvice}</p>
        </div>
    `;
}

function renderPartComments(data) {
    const list = document.getElementById('partDetailsList');
    list.innerHTML = '';
    
    data.partDetails.forEach(item => {
        const block = document.createElement('div');
        block.className = 'part-block';
        
        // Badges string
        const badgesHtml = item.labels.map(L => `<span class="part-reason-badge">${L}</span>`).join('');
        
        // Comments string
        const commentsHtml = item.comments.map(c => `
            <div class="comment-item">
                <span class="comment-quote">"</span>${c}<span class="comment-quote">"</span>
            </div>
        `).join('');

        block.innerHTML = `
            <div class="part-title">${item.part}</div>
            <div style="margin-bottom: 8px;">${badgesHtml}</div>
            <div class="comments-wrap">${commentsHtml}</div>
        `;
        list.appendChild(block);
    });
}

// ------------------------------------
// ECharts Renders
// ------------------------------------

function renderTrendChart(data) {
    const t = data.trend;
    const option = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: ['销量', '退款数', '退款率'], bottom: 0 },
        grid: { top: 40, right: 50, bottom: 40, left: 50 },
        xAxis: [{ type: 'category', data: t.dates, axisPointer: { type: 'shadow' } }],
        yAxis: [
            { type: 'value', name: '件数', splitLine: { lineStyle: { type: 'dashed' } } },
            { type: 'value', name: '退款率 (%)', splitLine: { show: false }, axisLabel: { formatter: '{value}%' } }
        ],
        series: [
            { name: '销量', type: 'bar', data: t.sales, itemStyle: { color: '#93c5fd', borderRadius: [2, 2, 0, 0] }, barWidth: '40%' },
            { name: '退款数', type: 'bar', data: t.returns, itemStyle: { color: '#fca5a5', borderRadius: [2, 2, 0, 0] }, barWidth: '40%' },
            { name: '退款率', type: 'line', yAxisIndex: 1, data: t.rates, itemStyle: { color: '#ef4444' }, smooth: true, lineStyle: { width: 3 } }
        ]
    };
    trendChart.setOption(option, true);
}

function renderPieChart(data) {
    const option = {
        tooltip: { trigger: 'item', formatter: '{b}: {c}件 ({d}%)' },
        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        series: [{
            type: 'pie',
            radius: ['40%', '75%'],
            center: ['50%', '50%'],
            label: { show: true, formatter: '{b}\n{d}%', fontSize: 12, color: '#4b5563' },
            data: data.reasons
        }]
    };
    reasonPieChart.setOption(option, true);
}

function renderDimBarChart(data, type) {
    const sourceArr = type === 'color' ? data.dimColor : data.dimSize;
    // Names on Y axis reversed because ECharts draws from bottom to top
    const yAxisData = sourceArr.map(s => s.name).reverse();
    const seriesData = sourceArr.map(s => s.count).reverse();
    const top3Data = sourceArr.map(s => s.top3).reverse();

    const option = {
        grid: { left: 70, top: 20, bottom: 20, right: 200 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { type: 'value', show: false },
        yAxis: { type: 'category', data: yAxisData, axisLine: { show: false }, axisTick: { show: false } },
        series: [{
            name: '退款数量',
            type: 'bar',
            data: seriesData,
            barWidth: 24,
            itemStyle: { color: '#93c5fd', borderRadius: [0, 4, 4, 0] },
            label: {
                show: true,
                position: 'right',
                formatter: function (param) {
                    return `{c|${param.value}件}  {top|核心原因: ${top3Data[param.dataIndex]}}`;
                },
                rich: {
                    c: { color: '#ef4444', fontWeight: 'bold', fontSize: 13 },
                    top: { color: '#6b7280', fontSize: 12 }
                }
            }
        }]
    };
    dimBarChart.setOption(option, true);
}

function renderPartDoughnut(data) {
    const option = {
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { bottom: 0, textStyle: { color: '#4b5563' } },
        series: [{
            name: '部位分布',
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}\n{c}%', color: '#4b5563', fontWeight: 600 },
            data: data.partCluster
        }]
    };
    partDoughnutChart.setOption(option, true);
}

function renderRegionBarChart(data) {
    const targetRateVal = parseFloat(data.metrics.targetRate);
    
    // Generate mocked data relative to targetRate
    const regionNames = ['北美站 (NA)', '欧洲站 (EU)', '日本站 (JP)', '澳洲站 (AU)', '中东站 (ME)'];
    const rates = [
        (targetRateVal * 1.5).toFixed(1),
        (targetRateVal * 1.2).toFixed(1),
        (targetRateVal * 0.9).toFixed(1),
        (targetRateVal * 0.8).toFixed(1),
        (targetRateVal * 0.5).toFixed(1)
    ];

    const option = {
        grid: { left: 90, top: 15, bottom: 20, right: 30 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b} : {c}%' },
        xAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { type: 'dashed' } } },
        yAxis: { type: 'category', data: regionNames.reverse(), axisLine: { show: false }, axisTick: { show: false } },
        series: [{
            name: '退款率',
            type: 'bar',
            data: rates.reverse(),
            barWidth: 20,
            itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] },
            label: { show: true, position: 'right', formatter: '{c}%' }
        }]
    };
    regionBarChart.setOption(option, true);
}
