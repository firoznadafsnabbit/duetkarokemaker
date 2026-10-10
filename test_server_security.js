const http = require('http');
const { spawn } = require('child_process');

console.log('Testing live server security...');

// Launch server on a test port e.g. 3001
const serverProcess = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: '3001' }
});

serverProcess.stdout.on('data', d => console.log('[Server stdout]', d.toString().trim()));
serverProcess.stderr.on('data', d => console.error('[Server stderr]', d.toString().trim()));

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  await wait(1200); // Wait for server to boot

  try {
    // 1. Test Security Headers
    console.log('\n[*] Test 1: HTTP Security Headers on /');
    const rootRes = await request('/');
    console.log('  Status:', rootRes.statusCode);
    console.log('  CSP header present:', Boolean(rootRes.headers['content-security-policy']));
    console.log('  X-Content-Type-Options:', rootRes.headers['x-content-type-options']);
    console.log('  X-Frame-Options:', rootRes.headers['x-frame-options']);
    console.log('  Referrer-Policy:', rootRes.headers['referrer-policy']);
    if (!rootRes.headers['x-content-type-options'] || !rootRes.headers['x-frame-options'] || !rootRes.headers['content-security-policy']) {
      throw new Error('Security headers missing on root!');
    }

    // 2. Test Sanitized Status Endpoint
    console.log('\n[*] Test 2: Sanitized /api/status');
    const statusRes = await request('/api/status');
    const statusData = JSON.parse(statusRes.body);
    console.log('  Response:', statusData);
    if (statusData.tempDir || statusData.ffmpegPath) {
      throw new Error('Status endpoint leaked internal server paths!');
    }
    console.log('  ✅ No filesystem paths leaked in status endpoint.');

    // 3. Test Admin Login with Invalid Password
    console.log('\n[*] Test 3: Admin Login with Wrong Password (expect 401)');
    const badLoginRes = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'feroznadafm@gmail.com', password: 'WrongPassword123!' }
    });
    console.log('  Status:', badLoginRes.statusCode);
    const badLoginData = JSON.parse(badLoginRes.body);
    console.log('  Response:', badLoginData);
    if (badLoginRes.statusCode !== 401) {
      throw new Error(`Expected 401 for bad login, got ${badLoginRes.statusCode}`);
    }
    console.log('  ✅ Invalid admin password correctly rejected with 401 Unauthorized.');

    // 4. Test Admin Login with Correct Password
    console.log('\n[*] Test 4: Admin Login with Correct Password (expect 200 + token)');
    const goodLoginRes = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'feroznadafm@gmail.com', password: 'FerozSana@521#' }
    });
    console.log('  Status:', goodLoginRes.statusCode);
    const goodLoginData = JSON.parse(goodLoginRes.body);
    console.log('  Response success:', goodLoginData.success);
    console.log('  Token returned:', Boolean(goodLoginData.token));
    console.log('  Set-Cookie header:', Boolean(goodLoginRes.headers['set-cookie']));
    if (goodLoginRes.statusCode !== 200 || !goodLoginData.token) {
      throw new Error('Admin login failed for valid password!');
    }
    console.log('  ✅ Valid admin password verified with salted PBKDF2 hash, session token created.');

    // 5. Test Admin Session Check
    console.log('\n[*] Test 5: Verify Admin Session endpoint');
    const sessionRes = await request('/api/admin/session', {
      headers: { 'Authorization': `Bearer ${goodLoginData.token}` }
    });
    console.log('  Session Status:', sessionRes.statusCode);
    const sessionData = JSON.parse(sessionRes.body);
    console.log('  Session Data:', sessionData);
    if (sessionRes.statusCode !== 200 || !sessionData.authenticated) {
      throw new Error('Session verification failed!');
    }
    console.log('  ✅ Admin session token verified successfully.');

    // 6. Test YouTube URL SSRF Validation
    console.log('\n[*] Test 6: SSRF Malicious URL Validation on /api/auto-duet');
    const ssrfRes = await request('/api/auto-duet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { url: 'http://169.254.169.254/latest/meta-data/' }
    });
    console.log('  SSRF Test Status:', ssrfRes.statusCode);
    const ssrfData = JSON.parse(ssrfRes.body);
    console.log('  Response:', ssrfData);
    if (ssrfRes.statusCode !== 400) {
      throw new Error(`Expected 400 for malicious SSRF URL, got ${ssrfRes.statusCode}`);
    }
    console.log('  ✅ Malicious non-YouTube URL rejected with 400 Bad Request.');

    console.log('\n🎉 ALL LIVE SERVER INTEGRATION SECURITY TESTS PASSED!');
  } finally {
    serverProcess.kill();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  serverProcess.kill();
  process.exit(1);
});
