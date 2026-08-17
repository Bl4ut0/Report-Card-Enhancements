# Optional Portal Integration

The n8n workflow does not implement user authentication. A separate trusted application may authenticate users through Discord, another identity provider, or an internal access system.

After authorization, the application backend sends:

```http
POST https://n8n.example.com/webhook/rce/v2/intake
Content-Type: application/json
X-RCE-Intake-Key: SERVER_SIDE_SECRET
```

```json
{
  "reportId": "AbCdEf123456GhJk",
  "requestedBy": "authorized-user",
  "source": "guild-portal"
}
```

The intake accepts only a 16-character alphanumeric Warcraft Logs report code. It returns the existing state for protected or completed reports and otherwise inserts or updates a queued ledger row.

Keep the intake key on the server. A browser should submit to the portal backend, and the backend should call n8n. Do not embed the n8n intake credential in browser configuration, HTML, or other downloadable assets.

Guild, server, role, OAuth, session, CSRF, and rate-limiting policy are installation-specific and deliberately outside this repository.
