const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

// Create proxy for video.xjcerp.com (main site API)
const videoProxy = httpProxy.createProxyServer({ target: 'http://video.xjcerp.com', changeOrigin: true });
// Create proxy for refund.xjcerp.com
const refundProxy = httpProxy.createProxyServer({ target: 'http://refund.xjcerp.com', changeOrigin: true });

videoProxy.on('error', (err, req, res) => { console.error('[VIDEO PROXY ERR]', err.message); try { res.writeHead(502); res.end('Proxy Error'); } catch(e){} });
refundProxy.on('error', (err, req, res) => { console.error('[REFUND PROXY ERR]', err.message); try { res.writeHead(502); res.end('Proxy Error'); } catch(e){} });

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml; charset=utf-8',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.mp4':  'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
};

function serveFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404); res.end('Not Found: ' + filePath);
            } else {
                res.writeHead(500); res.end('Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
            res.end(data);
        }
    });
}

const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const fullUrl = req.url;

    // --- SSO CALLBACK ---
    // Serve refund SPA for /sso/callback so the Vue app processes the OTT.
    // We serve a modified version that uses absolute paths to /refund/dist/
    if (urlPath === '/sso/callback') {
        console.log(`[SSO CALLBACK] ${req.method} ${fullUrl}`);
        // Read refund/index.html and fix relative paths to absolute
        const htmlPath = path.join(__dirname, 'refund', 'index.html');
        fs.readFile(htmlPath, 'utf8', (err, html) => {
            if (err) { res.writeHead(500); res.end('Error reading refund/index.html'); return; }
            // Fix relative paths: ./dist/ -> /refund/dist/
            html = html.replace(/\.\/dist\//g, '/refund/dist/');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
            res.end(html);
        });
        return;
    }

    // --- API ROUTING ---
    // Refund API: /api/v1/...
    if (urlPath.startsWith('/api/v1/')) {
        console.log(`[REFUND API] ${req.method} ${fullUrl}`);
        return refundProxy.web(req, res);
    }
    // Main site API: /api/...
    if (urlPath.startsWith('/api/')) {
        console.log(`[VIDEO API] ${req.method} ${fullUrl}`);
        return videoProxy.web(req, res);
    }

    // --- STATIC FILES ---
    let filePath = urlPath;
    if (filePath === '/') filePath = '/index.html';
    if (filePath.endsWith('/')) filePath += 'index.html';

    const absPath = path.join(__dirname, filePath);
    serveFile(absPath, res);
});

const PORT = 8899;
server.listen(PORT, () => {
    console.log('');
    console.log('==============================================');
    console.log(` 星骏AI工具箱 - 本地开发服务器`);
    console.log(` http://127.0.0.1:${PORT}/`);
    console.log('');
    console.log(' API代理:');
    console.log('   /api/*        -> video.xjcerp.com');
    console.log('   /api/v1/*     -> refund.xjcerp.com');
    console.log(' SSO回调:');
    console.log('   /sso/callback -> refund/index.html (SPA)');
    console.log('==============================================');
    console.log('');
});
