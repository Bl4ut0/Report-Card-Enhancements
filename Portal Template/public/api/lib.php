<?php
declare(strict_types=1);

if (!defined('RCE_PORTAL_BOOTSTRAP')) {
    http_response_code(404);
    exit;
}

function rce_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
}

function rce_validate_config(mixed $config): void
{
    if (!is_array($config)) throw new RuntimeException('Portal configuration must return an array.');
    $required = [
        'discord_client_id',
        'discord_client_secret',
        'redirect_uri',
        'guild_id',
        'required_role_id',
        'allowed_origin',
        'n8n_intake_url',
        'intake_secret',
        'session_name',
    ];
    foreach ($required as $key) {
        $value = trim((string) ($config[$key] ?? ''));
        if ($value === '' || str_contains($value, 'REPLACE_WITH_')) {
            throw new RuntimeException('Portal configuration is incomplete.');
        }
    }
    foreach (['discord_client_id', 'guild_id', 'required_role_id'] as $key) {
        if (!preg_match('/^\d{17,20}$/', (string) $config[$key])) {
            throw new RuntimeException('Discord identifier configuration is invalid.');
        }
    }
    foreach (['redirect_uri', 'allowed_origin', 'n8n_intake_url'] as $key) {
        $url = parse_url((string) $config[$key]);
        if (($url['scheme'] ?? '') !== 'https' || empty($url['host'])) {
            throw new RuntimeException('Portal endpoints must use HTTPS.');
        }
    }
    if (strlen((string) $config['discord_client_secret']) < 24 || strlen((string) $config['intake_secret']) < 24) {
        throw new RuntimeException('Portal secrets are too short.');
    }
}

function rce_bootstrap(array $config, bool $startSession = true): void
{
    rce_headers();
    if (!$startSession) return;

    session_name((string) ($config['session_name'] ?? 'rce_guild_portal'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();
}

function rce_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function rce_require_method(string $method): void
{
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== $method) {
        header('Allow: ' . $method);
        rce_json(['error' => 'method_not_allowed', 'message' => 'Method not allowed.'], 405);
    }
}

function rce_require_same_origin(array $config): void
{
    $origin = rtrim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), '/');
    $allowed = rtrim((string) $config['allowed_origin'], '/');
    if ($origin === '' || !hash_equals($allowed, $origin)) {
        rce_json(['error' => 'invalid_origin', 'message' => 'Request origin was rejected.'], 403);
    }
}

function rce_request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 8192) {
        rce_json(['error' => 'invalid_request', 'message' => 'Request body is invalid.'], 400);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        rce_json(['error' => 'invalid_json', 'message' => 'A JSON request body is required.'], 400);
    }
    return $decoded;
}

function rce_base64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function rce_discord_start(array $config): never
{
    rce_require_method('GET');
    $state = rce_base64url(random_bytes(32));
    $verifier = rce_base64url(random_bytes(64));
    $_SESSION['oauth_state'] = $state;
    $_SESSION['oauth_verifier'] = $verifier;
    $_SESSION['oauth_started_at'] = time();

    $query = http_build_query([
        'client_id' => $config['discord_client_id'],
        'redirect_uri' => $config['redirect_uri'],
        'response_type' => 'code',
        'scope' => 'identify guilds.members.read',
        'state' => $state,
        'code_challenge' => rce_base64url(hash('sha256', $verifier, true)),
        'code_challenge_method' => 'S256',
    ], '', '&', PHP_QUERY_RFC3986);

    header('Location: https://discord.com/oauth2/authorize?' . $query, true, 302);
    exit;
}

function rce_discord_exchange(array $config): never
{
    rce_require_method('POST');
    rce_require_same_origin($config);
    $body = rce_request_json();
    $code = trim((string) ($body['code'] ?? ''));
    $state = trim((string) ($body['state'] ?? ''));
    $storedState = (string) ($_SESSION['oauth_state'] ?? '');
    $verifier = (string) ($_SESSION['oauth_verifier'] ?? '');
    $startedAt = (int) ($_SESSION['oauth_started_at'] ?? 0);

    unset($_SESSION['oauth_state'], $_SESSION['oauth_verifier'], $_SESSION['oauth_started_at']);

    if ($code === '' || $state === '' || $storedState === '' || $verifier === '' ||
        !hash_equals($storedState, $state) || time() - $startedAt > 600) {
        rce_json(['error' => 'invalid_oauth_state', 'message' => 'The Discord sign-in request expired or could not be verified.'], 400);
    }

    $tokenResponse = rce_http('https://discord.com/api/v10/oauth2/token', [
        'method' => 'POST',
        'headers' => ['Content-Type: application/x-www-form-urlencoded'],
        'body' => http_build_query([
            'client_id' => $config['discord_client_id'],
            'client_secret' => $config['discord_client_secret'],
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $config['redirect_uri'],
            'code_verifier' => $verifier,
        ], '', '&', PHP_QUERY_RFC3986),
    ]);

    if ($tokenResponse['status'] !== 200 || empty($tokenResponse['json']['access_token'])) {
        rce_json(['error' => 'oauth_exchange_failed', 'message' => 'Discord did not accept the authorization response.'], 401);
    }

    $accessToken = (string) $tokenResponse['json']['access_token'];
    $resultPayload = [];
    $resultStatus = 200;
    try {
        $headers = ['Authorization: Bearer ' . $accessToken];
        $userResponse = rce_http('https://discord.com/api/v10/users/@me', ['headers' => $headers]);
        $memberResponse = rce_http(
            'https://discord.com/api/v10/users/@me/guilds/' . rawurlencode((string) $config['guild_id']) . '/member',
            ['headers' => $headers]
        );

        if ($userResponse['status'] !== 200 || $memberResponse['status'] !== 200) {
            $resultPayload = ['error' => 'membership_required', 'message' => 'Your Discord account is not a member of the required guild.'];
            $resultStatus = 403;
        } else {
            $roles = is_array($memberResponse['json']['roles'] ?? null) ? $memberResponse['json']['roles'] : [];
            if (!in_array((string) $config['required_role_id'], array_map('strval', $roles), true)) {
                $resultPayload = ['error' => 'role_required', 'message' => 'Your guild role is not authorized to submit reports.'];
                $resultStatus = 403;
            } else {
                session_regenerate_id(true);
                $username = (string) ($userResponse['json']['global_name'] ?? $userResponse['json']['username'] ?? 'Guild Member');
                $_SESSION['authorized'] = true;
                $_SESSION['discord_user_id'] = (string) $userResponse['json']['id'];
                $_SESSION['discord_username'] = $username;
                $_SESSION['authorized_at'] = time();
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
                $_SESSION['submissions'] = [];
                $resultPayload = ['authorized' => true, 'username' => $username, 'csrfToken' => $_SESSION['csrf_token']];
            }
        }
    } finally {
        rce_revoke_discord_token($config, $accessToken);
    }
    rce_json($resultPayload, $resultStatus);
}

function rce_session_status(): never
{
    rce_require_method('GET');
    $authorized = !empty($_SESSION['authorized']) && time() - (int) ($_SESSION['authorized_at'] ?? 0) < 28800;
    if (!$authorized) rce_json(['authorized' => false]);
    rce_json([
        'authorized' => true,
        'username' => (string) $_SESSION['discord_username'],
        'csrfToken' => (string) $_SESSION['csrf_token'],
    ]);
}

function rce_logout(array $config): never
{
    rce_require_method('POST');
    rce_require_same_origin($config);
    rce_require_csrf();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
    rce_json(['ok' => true]);
}

function rce_submit_report(array $config): never
{
    rce_require_method('POST');
    rce_require_same_origin($config);
    rce_require_authorized();
    rce_require_csrf();
    rce_enforce_rate_limit();

    $body = rce_request_json();
    $reportId = trim((string) ($body['reportId'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9]{16}$/', $reportId)) {
        rce_json(['error' => 'invalid_report_id', 'message' => 'Enter a valid 16-character Warcraft Logs report ID.'], 422);
    }

    $payload = json_encode([
        'reportId' => $reportId,
        'source' => 'guild-portal',
        'requestedBy' => (string) $_SESSION['discord_username'],
        'discordUserId' => (string) $_SESSION['discord_user_id'],
    ], JSON_UNESCAPED_SLASHES);

    $response = rce_http((string) $config['n8n_intake_url'], [
        'method' => 'POST',
        'headers' => [
            'Content-Type: application/json',
            'X-RCE-Intake-Key: ' . $config['intake_secret'],
        ],
        'body' => $payload,
        'timeout' => 15,
    ]);

    if ($response['status'] < 200 || $response['status'] >= 300) {
        rce_json(['error' => 'queue_unavailable', 'message' => 'The report queue is temporarily unavailable.'], 502);
    }

    $result = is_array($response['json']) ? $response['json'] : [];
    rce_json([
        'ok' => true,
        'reportId' => $reportId,
        'state' => (string) ($result['state'] ?? 'QUEUED'),
        'duplicate' => (bool) ($result['duplicate'] ?? false),
        'message' => (string) ($result['message'] ?? 'Report accepted by the queue.'),
    ], !empty($result['duplicate']) ? 200 : 202);
}

function rce_require_authorized(): void
{
    if (empty($_SESSION['authorized']) || time() - (int) ($_SESSION['authorized_at'] ?? 0) >= 28800) {
        rce_json(['error' => 'authentication_required', 'message' => 'Sign in with Discord before submitting a report.'], 401);
    }
}

function rce_require_csrf(): void
{
    $provided = (string) ($_SERVER['HTTP_X_RCE_CSRF'] ?? '');
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
        rce_json(['error' => 'invalid_csrf', 'message' => 'The secure session token was rejected.'], 403);
    }
}

function rce_enforce_rate_limit(): void
{
    $now = time();
    $attempts = array_values(array_filter((array) ($_SESSION['submissions'] ?? []), static fn($time) => $now - (int) $time < 600));
    if (count($attempts) >= 5) {
        rce_json(['error' => 'rate_limited', 'message' => 'Too many reports were submitted. Try again later.'], 429);
    }
    $attempts[] = $now;
    $_SESSION['submissions'] = $attempts;
}

function rce_http(string $url, array $options = []): array
{
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => (int) ($options['timeout'] ?? 20),
        CURLOPT_USERAGENT => 'RCE-Guild-Portal/1.0',
        CURLOPT_HTTPHEADER => (array) ($options['headers'] ?? []),
        CURLOPT_CUSTOMREQUEST => (string) ($options['method'] ?? 'GET'),
    ]);
    if (array_key_exists('body', $options)) curl_setopt($handle, CURLOPT_POSTFIELDS, $options['body']);
    $raw = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($raw === false) throw new RuntimeException('Outbound HTTP request failed: ' . $error);
    $decoded = json_decode((string) $raw, true);
    return ['status' => $status, 'json' => is_array($decoded) ? $decoded : null, 'raw' => (string) $raw];
}

function rce_revoke_discord_token(array $config, string $accessToken): void
{
    try {
        rce_http('https://discord.com/api/v10/oauth2/token/revoke', [
            'method' => 'POST',
            'headers' => ['Content-Type: application/x-www-form-urlencoded'],
            'body' => http_build_query([
                'client_id' => $config['discord_client_id'],
                'client_secret' => $config['discord_client_secret'],
                'token' => $accessToken,
                'token_type_hint' => 'access_token',
            ], '', '&', PHP_QUERY_RFC3986),
        ]);
    } catch (Throwable $error) {
        error_log('[rce-guild-portal] Discord token revocation failed.');
    }
}
