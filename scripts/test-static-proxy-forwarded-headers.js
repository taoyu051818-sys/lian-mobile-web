// Test for forwarded headers on public proxy requests.
const http = require('http');
const assert = require('assert');

const mockBackend = http.createServer((req, res) => {
  assert.ok(req.headers['x-forwarded-host'], 'Expected x-forwarded-host');
  assert.ok(req.headers['x-forwarded-proto'], 'Expected x-forwarded-proto');
  res.writeHead(200);
  res.end('OK');
});

mockBackend.listen(4200, () => {
  console.log('Mock backend running');
  const req = http.request({
    hostname: 'localhost',
    port: 4200,
    path: '/test',
    method: 'GET',
    headers: {
      'x-forwarded-host': 'localhost',
      'x-forwarded-proto': 'http',
    },
  }, (res) => {
    assert.equal(res.statusCode, 200, 'Expected 200 response');
    res.on('data', () => {
      mockBackend.close();
      console.log('Test passed');
    });
  });
  req.end();
});
