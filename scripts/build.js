const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
    const { build } = await import('vite');
    await build({ configFile: path.join(root, 'selection-demo', 'vite.config.mjs') });
    const output = path.join(root, 'dist');
    if (output !== path.resolve(root, 'dist')) throw new Error('Invalid output directory');
    await fs.rm(output, { recursive: true, force: true });
    await fs.mkdir(output, { recursive: true });
    for (const name of ['index.html', 'pages', 'static', 'refund', 'selection']) {
        await fs.cp(path.join(root, name), path.join(output, name), { recursive: true });
    }
    await fs.writeFile(path.join(root, '.build-ready'), new Date().toISOString());
    console.log('[OK] Deployment files prepared in dist/.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
