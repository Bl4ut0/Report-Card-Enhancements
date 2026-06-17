/**
 * Discord Webhook Proxy Worker for CLA/RPB.
 *
 * Required Worker secret:
 *   DISCORD_PROXY_SECRET
 *
 * Apps Script sends:
 *   x-discord-webhook: https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
 *   x-proxy-secret: YOUR_PROXY_SECRET
 */
export default {
  async fetch(request, env) {
    // Redirect direct browser GET requests to the repository to obscure endpoint existence
    if (request.method === 'GET') {
      return Response.redirect('https://github.com/Bl4ut0/Report-Card-Enhancements', 302);
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const targetUrl = request.headers.get('x-discord-webhook') || '';
    if (!targetUrl.startsWith('https://discord.com/api/webhooks/')) {
      return new Response('Invalid Target', { status: 400 });
    }

    const receivedSecret = request.headers.get('x-proxy-secret') || '';
    if (env.DISCORD_PROXY_SECRET && receivedSecret !== env.DISCORD_PROXY_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const discordResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') || 'application/json',
      },
      body: request.body,
    });

    if (discordResponse.status === 204) {
      return new Response(null, { status: 204 });
    }

    return new Response(await discordResponse.text(), {
      status: discordResponse.status,
      headers: {
        'content-type': discordResponse.headers.get('content-type') || 'text/plain',
      },
    });
  },
};
