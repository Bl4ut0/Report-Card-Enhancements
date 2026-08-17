# RCE Guild Portal Template

This is an optional, deployment-neutral frontend and PHP backend for authenticated manual report intake. It verifies a Discord user and required guild role, then calls the protected n8n intake webhook from the server.

No hosting scripts, domains, guild identifiers, role identifiers, OAuth credentials, artwork, or production endpoints are included.

## Requirements

- PHP 8.1 or newer with cURL and sessions
- HTTPS
- a Discord OAuth2 application
- an n8n unified RCE workflow with the `rce/v2/intake` Header Auth webhook
- a webserver whose document root points to `public/`

## Configure

1. Copy `config.example.php` to `config.php`.
2. Replace every `REPLACE_...` value.
3. Keep `config.php` outside the public document root.
4. Register the exact `redirect_uri` in the Discord Developer Portal.
5. Store the same intake secret in the n8n Header Auth credential.
6. Configure HTTPS, HSTS, request limits, and logging at your webserver or edge.

Disable PHP error display in production and log errors to a protected server-side destination.

The default layout assumes:

```text
portal/
  config.php
  public/        <- web document root
    index.php
    api/
```

Alternatively, set the `RCE_PORTAL_CONFIG` environment variable to the absolute path of the PHP configuration file.

## Discord Permissions

The OAuth flow requests only:

```text
identify guilds.members.read
```

The current-user guild membership endpoint returns the user’s roles for server-side authorization. A bot and privileged member-list intent are not required for this per-user role check.

## Security Model

- OAuth state and PKCE bind the authorization response to the initiating session.
- The OAuth code exchange, guild membership check, and role check happen server-side.
- Discord access tokens are revoked after verification.
- Sessions use Secure, HttpOnly, SameSite cookies and regenerate after login.
- State-changing routes require same-origin and CSRF validation.
- The n8n intake secret never reaches browser JavaScript.
- Report IDs are limited to 16 alphanumeric characters.

Add persistent per-user/IP rate limiting at the reverse proxy or edge. The built-in limiter is session-scoped and is only a secondary control.

## Not Included

This template deliberately contains no FTP/SFTP upload code, hosting-provider integration, DNS automation, guild artwork, or private service configuration. Users provide their own configuration and deploy it using the process appropriate for their environment.
