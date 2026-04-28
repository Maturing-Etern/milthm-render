const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const mime = {
  html: 'text/html', css: 'text/css', js: 'application/javascript',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  ico: 'image/x-icon', ttf: 'font/ttf', woff: 'font/woff',
  wasm: 'application/wasm', bin: 'application/octet-stream',
  zip: 'application/zip', json: 'application/json',
  data: 'application/octet-stream', mrp: 'application/octet-stream'
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url).replace(/[?#].*/, '');
  let file = path.join(root, url);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(file).slice(1).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
server.listen(7788, () => console.log('Server ready at http://localhost:7788'));
