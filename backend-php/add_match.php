<?php
// backend-php/add_match.php
require_once __DIR__ . '/core/Config.php';
require_once __DIR__ . '/core/Database.php';
Config::loadEnv(__DIR__ . '/.env');

$db = Database::getInstance();
$pdo = $db->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $matchId = $_POST['match_id'] ?? '';
    
    if (empty($matchId)) {
        echo "Error: Match ID is required.";
    } else {
        try {
            $stmt = $pdo->prepare("INSERT INTO matches (match_id, status) VALUES (?, 'live') ON DUPLICATE KEY UPDATE status = 'live'");
            $stmt->execute([$matchId]);
            echo "Successfully added/updated match: <b>$matchId</b> to monitoring list.<br>";
            echo "<a href='check_score.php'>Run Score Check Now</a>";
        } catch (Exception $e) {
            echo "Error: " . $e->getMessage();
        }
    }
}
?>

<h2>Add Match to Monitor</h2>
<form method="POST">
    Match ID (from Firebase): <input type="text" name="match_id" required>
    <button type="submit">Add Match</button>
</form>

<hr>
<h3>Current Monitored Matches:</h3>
<ul>
<?php
$stmt = $pdo->query("SELECT match_id, status FROM matches");
while ($row = $stmt->fetch()) {
    echo "<li>{$row['match_id']} ({$row['status']})</li>";
}
?>
</ul>
