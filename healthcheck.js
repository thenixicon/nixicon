const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/me',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200 || res.statusCode === 401) {
    // 200 = success, 401 = unauthorized (but server is running)
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
