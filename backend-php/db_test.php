<?php
// backend-php/db_test.php
require_once __DIR__ . '/core/Config.php';
Config::loadEnv(__DIR__ . '/.env');

function get_config($key, $default = '') {
    return $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key) ?: $default;
}

$host = get_config('DB_HOST', 'localhost');
$name = get_config('DB_NAME', 'cricket_live');
$user = get_config('DB_USER', 'root');
$pass = get_config('DB_PASS', '');

echo "<h2>Database Connection Test</h2>";
echo "Testing with:<br>";
echo "<b>Host:</b> $host<br>";
echo "<b>DB Name:</b> $name<br>";
echo "<b>User:</b> $user<br>";
echo "<b>Pass:</b> " . ($pass ? "******** (Length: ".strlen($pass).")" : "EMPTY") . "<br><br>";

try {
    $dsn = "mysql:host=$host;dbname=$name;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5, // Timeout after 5 seconds
    ];
    $pdo = new PDO($dsn, $user, $pass, $options);
    echo "<b style='color:green'>SUCCESS: Connection established!</b>";
} catch (PDOException $e) {
    echo "<b style='color:red'>FAILED:</b> " . $e->getMessage();
    
    if ($host === 'localhost') {
        echo "<br><br><b>Tip:</b> It seems DB_HOST is defaulting to 'localhost'. 
        This might mean your .env file is not being loaded correctly or putenv() is disabled. 
        Re-uploading the latest files might fix this.";
    }
}
