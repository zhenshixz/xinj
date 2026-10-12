const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
require('./ensure-build');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8899);
const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
});
let stopped = false;
child.on('error', (error) => {
    console.error(`[ERROR] Cannot start server: ${error.message}`);
    process.exitCode = 1;
    stopped = true;
});
child.on('exit', (code) => {
    stopped = true;
    process.exitCode = code || 0;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

function get(urlPath, timeout = 1500) {
    return new Promise((resolve, reject) => {
        const request = http.get({ hostname: '127.0.0.1', port, path: urlPath }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode, body, type: response.headers['content-type'] || '' }));
            response.on('error', reject);
        });
        request.setTimeout(timeout, () => request.destroy(new Error('Request timed out')));
        request.on('error', reject);
    });
}

(async () => {
    let ready = false;
    for (let attempt = 0; attempt < 30 && !stopped; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (stopped) return;
        try {
            const health = await get('/healthz');
            ready = health.status === 200 && JSON.parse(health.body).service === 'xinj-local';
            if (ready) break;
        } catch (_) { /* Wait for the server to listen. */ }
    }
    if (stopped) return;
    if (!ready) throw new Error('Server did not become ready. Check the port and startup errors above.');
    const home = await get('/');
    const css = await get('/static/css/new-app.css');
    if (home.status !== 200 || !home.type.includes('text/html') || css.status !== 200 || !css.type.includes('text/css') || !css.body.includes('--bg:')) {
        throw new Error('Homepage or stylesheet check failed.');
    }
    console.log('[OK] Server, homepage and stylesheet checks passed.');
    for (const page of ['/refund/', '/refund/deep/', '/selection/', '/selection/data/case.json']) {
        const result = await get(page);
        if (result.status !== 200) throw new Error(`Integrated page check failed: ${page} (HTTP ${result.status})`);
    }
    console.log('[OK] Refund pages and selection demo checks passed.');
    console.log(`[OPEN] http://127.0.0.1:${port}/`);
    console.log('[INFO] Keep this window open. Press Ctrl+C to stop.');
    try {
        const api = await get('/api/site/config', 8000);
        if (api.status !== 200 || JSON.parse(api.body).code !== 200) throw new Error(`HTTP ${api.status}`);
        console.log('[OK] Main API proxy check passed.');
    } catch (error) {
        console.warn(`[WARN] API check failed: ${error.message}. Check network access to video.xjcerp.com.`);
    }
})().catch((error) => {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 1;
    child.kill();
});
