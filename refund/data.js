const MOCK_DATA = {
    'CW250221092': { // Floral Dress
        base: {
            image: 'assets/img1.png', sku: 'CW250221092', name: '法式复古V领碎花连衣长裙',
            designLead: '张小仙', opsLead: '李大牛',
            tags: [
                { label: '目标退货率', value: '20.0%' }, { label: '分类', value: '女装' },
                { label: '年份', value: '2026' }, { label: '季节', value: '夏季' }
            ]
        },
        metrics: { targetRate: '20.0%', sales: '12,500', returns: '3,500' },
        trend: {
            dates: ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'],
            sales: [1500, 1800, 2000, 2200, 2400, 2600],
            returns: [300, 396, 480, 580, 680, 1064],
            rates: [20.0, 22.0, 24.0, 26.3, 28.3, 40.9]
        },
        reasons: [
            { name: '尺寸偏小', value: 1200 }, { name: '描述不符', value: 800 },
            { name: '配送超时', value: 600 }, { name: '质量问题', value: 500 }, { name: '不想要', value: 400 }
        ],
        dimColor: [
            { name: '黄色', count: 180, top3: '尺寸偏紧(60%) | 掉色(25%) | 线头(15%)' },
            { name: '蓝色', count: 120, top3: '尺寸偏紧(50%) | 布料粗糙(30%) | 掉色(20%)' },
            { name: '白色', count: 85, top3: '描述不符(70%) | 偏紧(20%) | 色差(10%)' }
        ],
        dimSize: [
            { name: 'M码', count: 210, top3: '尺码偏紧(80%) | 无弹力(15%) | 其他(5%)' },
            { name: 'S码', count: 150, top3: '尺码偏紧(60%) | 收口紧(30%) | 描述(10%)' },
            { name: 'L码', count: 25, top3: '领口大(60%) | 开线(30%) | 物流(10%)' }
        ],
        partCluster: [
            { name: '腰部', value: 60, itemStyle: {color: '#ef4444'} },
            { name: '面料整体', value: 25, itemStyle: {color: '#f59e0b'} },
            { name: '肩部', value: 15, itemStyle: {color: '#3b82f6'} }
        ],
        partDetails: [
            { part: '腰部', labels: ['尺码偏小 (80%)', '无弹力 (20%)'], comments: [
                '腰部太勒了，无法呼吸', '尺码偏小，特别是腰围部分', '面料没弹力，坐下手痛'
            ] },
            { part: '面料整体', labels: ['退色严重 (60%)', '刺挠 (40%)'], comments: [
                '洗了一次掉色严重', '本来买的黄色，洗完成了黄白色，这褪色质量也太差了'
            ] },
            { part: '肩部', labels: ['偏窄 (100%)'], comments: [
                '肩膀处偏窄，手都抬不起来', '版型奇怪，肩膀设计得太靠向中间'
            ] }
        ],
        aiColorAdvice: '退款最多的颜色：<span class="highlight">黄色</span>。建议优化布料染色工艺并更换稳固的固色剂，减少消费者关于掉色的集中客诉。',
        aiSizeAdvice: '退款最多的尺码：<span class="highlight">M 码</span>。核心为偏紧问题，建议针对核心受众人群的 M 码调整放缩尺码表，整体胸衣围放宽 1.5cm。',
        aiPartAdvice: '最高频退款部位：<span class="highlight">腰部</span>。主要受到面料无弹力的影响，建议在背侧加入隐形松紧带设计并适当放飞腰部纸样2cm，提升体感兼容度。'
    },
    'XJCW2521047': { // Cargo Pants
        base: {
            image: 'assets/img2.png', sku: 'XJCW2521047', name: '美式复古宽松多口袋工装裤',
            designLead: '王中路', opsLead: '赵六',
            tags: [
                { label: '目标退货率', value: '15.0%' }, { label: '分类', value: '男装' },
                { label: '年份', value: '2026' }, { label: '风格', value: '工装复古' }
            ]
        },
        metrics: { targetRate: '15.0%', sales: '8,000', returns: '4,200' },
        trend: {
            dates: ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'],
            sales: [500, 1000, 1200, 1500, 1800, 2000],
            returns: [100, 300, 480, 750, 1044, 1526],
            rates: [20.0, 30.0, 40.0, 50.0, 58.0, 76.3]
        },
        reasons: [
            { name: '尺寸偏大/太长', value: 2000 }, { name: '水洗褪色', value: 1000 },
            { name: '版型不符', value: 800 }, { name: '不想要', value: 400 }
        ],
        dimColor: [
            { name: '军绿', count: 800, top3: '裤长过长(50%) | 水洗褪色(30%) | 质量差(20%)' },
            { name: '卡其', count: 400, top3: '裤长过长(60%) | 腰围偏大(30%) | 色差(10%)' }
        ],
        dimSize: [
            { name: 'L码', count: 700, top3: '裤长过长(80%) | 腰围偏大(15%) | 其他(5%)' },
            { name: 'XL码', count: 500, top3: '裤长过长(70%) | 腰偏大(20%) | 褪色(10%)' }
        ],
        partCluster: [
            { name: '腿部(裤脚)', value: 60, itemStyle: {color: '#ef4444'} },
            { name: '腰部(围度)', value: 25, itemStyle: {color: '#f59e0b'} },
            { name: '面料整体', value: 15, itemStyle: {color: '#3b82f6'} }
        ],
        partDetails: [
            { part: '腿部(裤脚)', labels: ['尺码偏长 (100%)'], comments: [
                '裤腿也太长了，踩在地上完全不能走', '拖地严重，不仅脏还容易绊倒', '给一米九的人穿的吧？'
            ] },
            { part: '腰部(围度)', labels: ['腰围偏松 (100%)'], comments: [
                '不系腰带根本穿不了，直接往下掉', '买的平时穿的型号，腰大了很多', '建议增加内部抽绳'
            ] },
            { part: '面料整体', labels: ['水洗褪色严重 (100%)'], comments: [
                '军绿色洗了一次水就泛白了，巨无语', '布料很容易皱，洗完像抹布一样'
            ] }
        ],
        aiColorAdvice: '退款最多的颜色：<span class="highlight">军绿</span>。建议严格控制印染供应链的水洗环节要求，重打水洗缸样以修复军绿色的洗落色客诉。',
        aiSizeAdvice: '退款最多的尺码：<span class="highlight">L 码</span>。基于数据，L 和 XL 的偏大情况最为严重，建议按当前放缩表将这部分大码段的裤长统一下调 3cm，腰宽下调 1.5cm。',
        aiPartAdvice: '最高频退款部位：<span class="highlight">腿部裤长</span>。过长引发了超过60%的整体退单。建议立刻进行纸样干预缩减基础裤长，并增加裤脚松紧/魔术贴抽绳防拖地设计。'
    },
    'XJCW240921516': { // Down Jacket
        base: {
            image: 'assets/img3.png', sku: 'XJCW240921516', name: '极简保暖立领白鸭绒羽绒服',
            designLead: '李雪', opsLead: '陈风',
            tags: [
                { label: '目标退货率', value: '30.0%' }, { label: '核心优势', value: '爆款' },
                { label: '年份', value: '2024' }, { label: '季节', value: '冬季' }
            ]
        },
        metrics: { targetRate: '30.0%', sales: '15,000', returns: '2,250' },
        trend: {
            dates: ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'],
            sales: [1500, 3000, 4000, 3500, 2000, 1000],
            returns: [210, 480, 680, 525, 260, 95],
            rates: [14.0, 16.0, 17.0, 15.0, 13.0, 9.5]
        },
        reasons: [
            { name: '羽绒异味', value: 800 }, { name: '发货极慢', value: 700 },
            { name: '尺码偏紧', value: 400 }, { name: '充绒量少', value: 350 }
        ],
        dimColor: [
            { name: '米白', count: 500, top3: '充绒量少(60%) | 发货慢(30%) | 其他(10%)' },
            { name: '黑色', count: 300, top3: '异味大(70%) | 发货慢(20%) | 粘毛(10%)' }
        ],
        dimSize: [
            { name: 'M码', count: 400, top3: '异味(40%) | 发货慢(40%) | 肩宽偏紧(20%)' },
            { name: 'L码', count: 350, top3: '肩宽偏紧(50%) | 发货慢(30%) | 洗后跑毛(20%)' }
        ],
        partCluster: [
            { name: '内里填充物', value: 65, itemStyle: {color: '#ef4444'} },
            { name: '肩袖连接处', value: 20, itemStyle: {color: '#f59e0b'} },
            { name: '外部拉链', value: 15, itemStyle: {color: '#3b82f6'} }
        ],
        partDetails: [
            { part: '内里填充物', labels: ['羽绒腥味重 (70%)', '跑毛 (30%)'], comments: [
                '有一股鸭子的腥臭味，风吹了几天还是有', '说是90白鸭绒，怎么洗了有怪味', '跑毛严重，里面穿黑色毛衣全是白色绒毛'
            ] },
            { part: '肩袖连接处', labels: ['偏紧 (100%)'], comments: [
                '袖口收得太紧，里面穿不了加绒卫衣', '肩线做窄了，平时也是穿的M号，但这件穿上活动受限'
            ] },
            { part: '外部拉链', labels: ['卡顿不顺滑 (100%)'], comments: [
                '拉链总卡在中段', '冷天拉拉链很费劲，能不能换个好点的树脂拉链'
            ] }
        ],
        aiColorAdvice: '退款最多的颜色：<span class="highlight">米白</span>。浅色系充绒客诉高，可能在视觉上受到内部透色的影响，另外黑色款异味客诉密集，建议按色系区分抽样验证成分。',
        aiSizeAdvice: '退款核心尺码：<span class="highlight">M 码 与 L 码</span>。除了交货慢的物流共性原因外，该两码段反馈肩宽不足，建议内部纸样胸宽横向拉升 1cm。',
        aiPartAdvice: '占比最高的问题核心：<span class="highlight">内部填充物异味</span>。这直接阻断了高溢价感，强烈建议全面排查鸭绒供应商脱脂脱臭及杀菌水洗的各道工序指标。另外需提前锁定布面拉链物料以避免因断货发生物流挤兑。'
    }
};
