const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
    const source = await fs.readFile(path.join(root, 'refund/index.html'), 'utf8') + await fs.readFile(path.join(root, 'refund/app.js'), 'utf8');
    const names = [...new Set([...source.matchAll(/<span[^>]*class="[^"]*material-symbols-outlined[^"]*"[^>]*>([^<]+)<\/span>/g)].map((match) => match[1].trim()).filter((name) => /^[a-z_]+$/.test(name)))].sort();
    const response = await fetch('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=' + names.join(','), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Font CSS unavailable');
    const css = await response.text();
    const url = css.match(/url\((https:\/\/fonts.gstatic.com\/[^)]+)\)/)?.[1];
    if (!url) throw new Error('Font URL missing');
    const font = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!font.ok) throw new Error('Font download failed');
    await fs.mkdir(path.join(root, 'static/fonts'), { recursive: true });
    await fs.writeFile(path.join(root, 'static/fonts/refund-symbols.ttf'), Buffer.from(await font.arrayBuffer()));
    await fs.writeFile(path.join(root, 'static/css/refund-fonts.css'), css.replace(url, '/static/fonts/refund-symbols.ttf'));
    console.log(`[OK] Vendored ${names.length} refund icons.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
