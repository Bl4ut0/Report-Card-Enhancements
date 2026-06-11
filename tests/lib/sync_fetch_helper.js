import fs from 'node:fs';
import { argv } from 'node:process';

async function main() {
  const payloadFile = argv[2];
  const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
  
  const { url, options } = payload;
  const method = options.method || 'GET';
  const headers = options.headers || {};
  const body = options.payload || options.body || null;
  
  try {
    const res = await fetch(url, {
      method,
      headers,
      body
    });
    const text = await res.text();
    const responseHeaders = {};
    res.headers.forEach((val, key) => { responseHeaders[key] = val; });
    
    console.log(JSON.stringify({
      success: true,
      status: res.status,
      headers: responseHeaders,
      text: text
    }));
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      error: err.message
    }));
  }
}

main().catch(err => {
  console.log(JSON.stringify({ success: false, error: err.message }));
});
