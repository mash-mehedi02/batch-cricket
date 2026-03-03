<?php
// backend-php/services/ScoreService.php

class ScoreService {
    private $db;
    private $fcm;

    public function __construct($db, $fcm) {
        $this->db = $db;
        $this->fcm = $fcm;
    }

    /**
     * Fetch all matches with status "live" from Firestore
     */
    public function fetchLiveMatchIds() {
        $projectId = $_ENV['FCM_PROJECT_ID'] ?? $_SERVER['FCM_PROJECT_ID'] ?? getenv('FCM_PROJECT_ID');
        $url = "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents:runQuery";

        $query = [
            'structuredQuery' => [
                'from' => [['collectionId' => 'matches']],
                'where' => [
                    'fieldFilter' => [
                        'field' => ['fieldPath' => 'status'],
                        'op' => 'EQUAL',
                        'value' => ['stringValue' => 'live']
                    ]
                ]
            ]
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($query));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("Failed to query Firestore ($httpCode): $result");
            return [];
        }

        $response = json_decode($result, true);
        $matchIds = [];
        
        if (is_array($response)) {
            foreach ($response as $item) {
                if (isset($item['document']['name'])) {
                    $parts = explode('/', $item['document']['name']);
                    $matchIds[] = end($parts);
                }
            }
        }
        
        return $matchIds;
    }
    /**
     * Fetch match score from Firestore via REST API
     */
    public function fetchScore($matchId) {
        $projectId = $_ENV['FCM_PROJECT_ID'] ?? $_SERVER['FCM_PROJECT_ID'] ?? getenv('FCM_PROJECT_ID');
        $url = "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents/matches/{$matchId}";

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("Failed to fetch match from Firestore ($httpCode): $result");
        }

        $data = json_decode($result, true);
        $fields = $data['fields'] ?? [];

        // Helper to extract Firestore values
        $getVal = function($field, $type = 'stringValue') use ($fields) {
            return $fields[$field][$type] ?? null;
        };

        $currentBatting = $getVal('currentBatting');
        $inningsKey = $currentBatting === 'teamB' ? 'teamBInnings' : 'teamAInnings';
        
        $inningsData = $fields[$inningsKey]['mapValue']['fields'] ?? [];
        
        return [
            'match_id' => $matchId,
            'runs' => (int)($inningsData['totalRuns']['integerValue'] ?? 0),
            'wickets' => (int)($inningsData['totalWickets']['integerValue'] ?? 0),
            'overs' => (float)($inningsData['overs']['stringValue'] ?? 0.0),
            'innings' => $currentBatting === 'teamB' ? 2 : 1,
            'batsmen' => [] // Firestore structure for batsmen might need more complex parsing
        ];
    }

    public function processMatchUpdate($currentScore) {
        $matchId = $currentScore['match_id'];
        $pdo = $this->db->getConnection();

        // Get last stored state
        $stmt = $pdo->prepare("SELECT * FROM matches WHERE match_id = ?");
        $stmt->execute([$matchId]);
        $lastState = $stmt->fetch();

        if (!$lastState) {
            // New match, initialize it
            $stmt = $pdo->prepare("INSERT INTO matches (match_id, last_runs, last_wickets, last_over, innings) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$matchId, $currentScore['runs'], $currentScore['wickets'], $currentScore['overs'], $currentScore['innings']]);
            return;
        }

        // 1. Detect Wicket
        if ($currentScore['wickets'] > $lastState['last_wickets']) {
            $this->logAndNotify($matchId, 'WICKET', "WICKET! Score: {$currentScore['runs']}/{$currentScore['wickets']}", [
                'match_id' => $matchId,
                'event_type' => 'WICKET',
                'runs' => $currentScore['runs'],
                'wickets' => $currentScore['wickets']
            ]);
        }

        // 2. Detect Milestones (50/100)
        foreach ($currentScore['batsmen'] as $batsman) {
            if ($batsman['runs'] >= 50 && $batsman['runs'] < 100) {
                $this->checkBatsmanMilestone($matchId, $batsman, 'FIFTY');
            } elseif ($batsman['runs'] >= 100) {
                $this->checkBatsmanMilestone($matchId, $batsman, 'CENTURY');
            }
        }

        // 3. Detect Innings Break
        if ($currentScore['innings'] > $lastState['innings']) {
            $this->logAndNotify($matchId, 'INNINGS_BREAK', "Innings Break: {$currentScore['runs']}/{$lastState['last_wickets']}", [
                'match_id' => $matchId,
                'event_type' => 'INNINGS_BREAK'
            ]);
        }

        // Update last state
        $stmt = $pdo->prepare("UPDATE matches SET last_runs = ?, last_wickets = ?, last_over = ?, innings = ? WHERE match_id = ?");
        $stmt->execute([$currentScore['runs'], $currentScore['wickets'], $currentScore['overs'], $currentScore['innings'], $matchId]);
    }

    private function checkBatsmanMilestone($matchId, $batsman, $type) {
        $pdo = $this->db->getConnection();
        $eventData = "batsman_{$batsman['id']}";
        
        $stmt = $pdo->prepare("SELECT id FROM events_log WHERE match_id = ? AND event_type = ? AND event_data = ?");
        $stmt->execute([$matchId, $type, $eventData]);
        
        if (!$stmt->fetch()) {
            $title = $type === 'FIFTY' ? "HALF CENTURY!" : "CENTURY!";
            $body = "{$batsman['name']} scored {$batsman['runs']} runs!";
            $this->logAndNotify($matchId, $type, $body, [
                'match_id' => $matchId,
                'event_type' => $type,
                'batsman_name' => $batsman['name']
            ], $eventData);
        }
    }

    private function logAndNotify($matchId, $type, $body, $data, $eventData = '') {
        $pdo = $this->db->getConnection();
        
        // Log event to prevent duplicates
        $stmt = $pdo->prepare("INSERT INTO events_log (match_id, event_type, event_data) VALUES (?, ?, ?)");
        $stmt->execute([$matchId, $type, $eventData]);

        // Send FCM notification
        $this->fcm->sendToTopic("match_$matchId", "Cricket Live Update", $body, $data);
    }
}
