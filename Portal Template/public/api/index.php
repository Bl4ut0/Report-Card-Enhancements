<?php
declare(strict_types=1);

$route = trim((string) ($_GET['route'] ?? ''), '/');
$configuredPath = trim((string) getenv('RCE_PORTAL_CONFIG'));
$configPath = $configuredPath !== ''
    ? $configuredPath
    : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'config.php';

define('RCE_PORTAL_BOOTSTRAP', true);
require __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

if (!is_file($configPath)) {
    rce_headers();
    rce_json(['error' => 'server_not_configured', 'message' => 'Portal authentication is not configured.'], 503);
}

try {
    $config = require $configPath;
    rce_validate_config($config);
    rce_bootstrap($config, $route !== 'health');

    switch ($route) {
        case 'health':
            rce_require_method('GET');
            rce_json(['ok' => true, 'service' => 'rce-guild-portal']);
            break;
        case 'discord/start':
            rce_discord_start($config);
            break;
        case 'discord/exchange':
            rce_discord_exchange($config);
            break;
        case 'session':
            rce_session_status();
            break;
        case 'logout':
            rce_logout($config);
            break;
        case 'reports':
            rce_submit_report($config);
            break;
        default:
            rce_json(['error' => 'not_found', 'message' => 'Unknown API route.'], 404);
    }
} catch (Throwable $error) {
    rce_headers();
    error_log('[rce-guild-portal] ' . $error->getMessage());
    rce_json(['error' => 'server_error', 'message' => 'The portal could not complete this request.'], 500);
}
