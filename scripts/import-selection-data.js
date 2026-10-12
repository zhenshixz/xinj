// Optional fixture refresh; normal builds use the data already committed in this repo.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-selection-data.js <selection-project-directory>');
const target = path.resolve(__dirname, '../selection-demo/public');
const query = 'Womens Puff Long Sleeve Button Down Shirts';
async function read(file) { return JSON.parse(await fs.readFile(path.join(source, file), 'utf8')); }
(async () => {
    await fs.mkdir(path.join(target, 'data'), { recursive: true });
    await fs.mkdir(path.join(target, 'images'), { recursive: true });
    const files = await fs.readdir(path.join(source, '.runtime/search-cache'));
    const snapshots = await Promise.all(files.map((name) => read('.runtime/search-cache/' + name)));
    const pages = [1, 2, 3].map((page) => snapshots.filter((item) => item.query === query && item.page === page).sort((a,b) => b.fetchedAt.localeCompare(a.fetchedAt))[0]);
    if (pages.some((item) => !item?.products?.length)) throw new Error('Three real search pages are required.');
    const saved = await read('.runtime/acceptance/public-browser-report.json');
    const anchor = saved.anchors.find((item) => item.asin === 'B0FF9S1DVQ');
    if (!anchor?.details) throw new Error('Saved anchor details missing.');
    const id = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const job = await read(`.runtime/design-images/${id}.json`);
    if (job.status !== 'complete') throw new Error('A completed historical image job is required.');
    for (const [ext, dest] of [['original', 'anchor-original.jpg'], ['image', 'anchor-edit.png']]) {
        await fs.copyFile(path.join(source, `.runtime/design-images/${id}.${ext}`), path.join(target, 'images', dest));
    }
    const products = new Map(pages.flatMap((item) => item.products).map((item) => [item.asin, item]));
    let unavailable = 0;
    const queue = [...products.values()];
    await Promise.all(Array.from({ length: 8 }, async () => {
        while (queue.length) {
            const product = queue.shift();
            const url = new URL(product.image);
            if (!['m.media-amazon.com', 'images-na.ssl-images-amazon.com'].includes(url.hostname)) throw new Error('Unexpected image host');
            const filename = crypto.createHash('sha256').update(product.image).digest('hex').slice(0,20) + '.jpg';
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
                if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Image unavailable');
                const bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length > 12000000) throw new Error('Image too large');
                await fs.writeFile(path.join(target, 'images', filename), bytes);
                product.image = '/selection/images/' + filename;
            } catch { product.image = '/selection/images/unavailable.svg'; unavailable++; }
        }
    }));
    for (const page of pages) {
        page.products = page.products.map((product) => ({ ...product, image: products.get(product.asin).image }));
    }
    anchor.image = '/selection/images/anchor-original.jpg';
    const data = {
        query, capturedFrom: pages[0].fetchedAt, capturedTo: pages[2].fetchedAt,
        pages, anchor, keywordValidation: saved.analysis.keywordValidation,
        job: { ...job, originalUrl: '/selection/images/anchor-original.jpg', imageUrl: '/selection/images/anchor-edit.png' },
    };
    await fs.writeFile(path.join(target, 'data', 'case.json'), JSON.stringify(data));
    await fs.writeFile(path.join(target, 'images', 'unavailable.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360"><rect width="300" height="360" fill="#f1f5f9"/><text x="150" y="180" text-anchor="middle" font-size="18" fill="#64748b">历史商品图暂不可用</text></svg>');
    console.log(`[OK] Imported ${products.size} products, three pages and a completed image pair; ${unavailable} product images unavailable.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
