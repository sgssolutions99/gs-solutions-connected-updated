const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const publicDir = path.join(__dirname, '..', 'public');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgs-inline-check-'));
let failures = 0;
try {
  for (const file of fs.readdirSync(publicDir).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
    scripts.forEach((match, index) => {
      const source = match[1];
      if (!source.trim()) return;
      const tempFile = path.join(tempDir, `${path.basename(file, '.html')}-${index + 1}.js`);
      fs.writeFileSync(tempFile, source);
      const result = spawnSync(process.execPath, ['--check', tempFile], { encoding: 'utf8' });
      if (result.status !== 0) {
        failures++;
        process.stderr.write(`\n${file} inline script ${index + 1}:\n${result.stderr}`);
      }
    });
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
if (failures) process.exit(1);
console.log('All inline JavaScript in public HTML files passes syntax checks.');
