/**
 * 초소형 로컬 웹 서버 (server.js)
 * PowerShell Script 실행 제한 정책이 걸려 있는 윈도우 환경에서도
 * 에러 없이 정적 웹 리소스(html, css, js)를 로컬 호스트 포트 8080에 즉시 배포 구동합니다.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // 기본 루트 접속 시 index.html 서빙
    let filePath = req.url === '/' ? './index.html' : '.' + req.url;
    filePath = path.resolve(__dirname, filePath);

    // 디렉토리 트래버설 취약점 기본 가드
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Access Denied');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('파일을 찾을 수 없습니다: ' + path.basename(filePath));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('서버 오류가 발생했습니다: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 분수 마스터 로컬 개발 서버 가동 완료!`);
    console.log(`👉 브라우저 주소창에 아래 주소를 입력하여 실행하세요:`);
    console.log(`   ▶  http://localhost:${PORT}`);
    console.log(`====================================================`);
});
