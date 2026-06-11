import 'dotenv/config';
import { V2Client } from './lib/v2_client.js';

async function main() {
  const reportCode = '1XPTmVrMBQkAbFG2';
  const proxyUrl = process.env.WCL_PROXY_URL || 'https://falling-forest-3c7a.bl4ut0.workers.dev/wcl';
  const proxySecret = process.env.WCL_PROXY_SECRET || 'UQKJp4jRw9Ts6XLXYSEiR9ZUGCJvBn0fZ9hnE2SLlhBMuy4pMr8lK2YDcMGvEPvJ';

  const clientCreds = {
    id: process.env.WCL_V2_CLIENT_ID,
    secret: process.env.WCL_V2_CLIENT_SECRET
  };

  console.log(`Using Proxy URL: ${proxyUrl}`);
  console.log(`Using Client ID: ${clientCreds.id}`);

  // 1. Fetch OAuth Access Token from WCL via proxy
  console.log("Fetching Access Token via proxy...");
  
  const tokenEnvelope = {
    url: 'https://www.warcraftlogs.com/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientCreds.id}:${clientCreds.secret}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  };

  const tokenResponse = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wcl-proxy-secret': proxySecret
    },
    body: JSON.stringify(tokenEnvelope)
  });

  console.log(`Token response status: ${tokenResponse.status}`);
  if (tokenResponse.status !== 200) {
    const text = await tokenResponse.text();
    console.error('Failed to get token:', text);
    return;
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  console.log('✅ Access token retrieved successfully.');

  // 2. Fetch fights using the token via proxy
  const query = `query ($code: String!) {
    reportData {
      report(code: $code) {
        title
        startTime
        endTime
      }
    }
  }`;

  const envelope = {
    url: 'https://www.warcraftlogs.com/api/v2/client',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    },
    body: JSON.stringify({
      query,
      variables: { code: reportCode }
    })
  };

  console.log("Fetching fights list via proxy...");
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wcl-proxy-secret': proxySecret
    },
    body: JSON.stringify(envelope)
  });

  console.log(`Fights response status: ${response.status}`);
  const headers = {};
  response.headers.forEach((val, key) => { headers[key] = val; });
  console.log('Fights response headers:', headers);

  const text = await response.text();
  console.log('Fights response body:', text);
}

main().catch(console.error);
