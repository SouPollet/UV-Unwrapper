const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/log' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            console.log("RECEIVED: ", body);
            res.end('ok');
            process.exit(0);
        });
    } else {
        res.end('Listening...');
    }
});
server.listen(8080, () => {
    console.log('Listening on 8080');
});
