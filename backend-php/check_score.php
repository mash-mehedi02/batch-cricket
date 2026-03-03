<?php
// backend-php/check_score.php

require_once __DIR__ . '/core/Config.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/services/FcmService.php';
require_once __DIR__ . '/services/ScoreService.php';

// 1. Load Environment Variables
Config::loadEnv(__DIR__ . '/.env');

// 2. Initialize Core Services
$db = Database::getInstance();
$fcm = new FcmService();
$scoreService = new ScoreService($db, $fcm);

// 3. Automated Match Discovery
try {
    $activeMatches = $scoreService->fetchLiveMatchIds();
} catch (Exception $e) {
    echo "Error discovering matches: " . $e->getMessage() . "\n";
    $activeMatches = [];
}

if (empty($activeMatches)) {
    echo "No live matches found in Firestore.\n";
    exit;
}

// 4. Poll and Process each active match
foreach ($activeMatches as $matchId) {
    try {
        $currentScore = $scoreService->fetchScore($matchId);
        $scoreService->processMatchUpdate($currentScore);
        echo "Successfully processed match: $matchId\n";
    } catch (Exception $e) {
        $msg = "[" . date('Y-m-d H:i:s') . "] Error processing $matchId: " . $e->getMessage();
        error_log($msg);
        echo $msg . "\n";
    }
}
