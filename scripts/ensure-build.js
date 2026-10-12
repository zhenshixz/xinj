const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function newest(target) {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) return stat.mtimeMs;
    return Math.max(stat.mtimeMs, ...fs.readdirSync(target).map((name) => newest(path.join(target, name))));
}
const marker = path.join(root, '.build-ready');
const inputs = ['selection-demo', 'scripts/build.js', 'package.json', 'package-lock.json', 'index.html', 'pages', 'static', 'refund'];
if (!fs.existsSync(marker) || !fs.existsSync(path.join(root, 'selection/index.html')) || inputs.some((name) => newest(path.join(root, name)) > fs.statSync(marker).mtimeMs)) {
    console.log('[INFO] Preparing the updated selection demo...');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
}
