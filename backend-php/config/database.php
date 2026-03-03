<?php
// backend-php/config/database.php

function get_config($key, $default = '') {
    return $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key) ?: $default;
}

return [
    'host' => get_config('DB_HOST', 'localhost'),
    'name' => get_config('DB_NAME', 'cricket_live'),
    'user' => get_config('DB_USER', 'root'),
    'pass' => get_config('DB_PASS', ''),
    'charset' => 'utf8mb4',
];
