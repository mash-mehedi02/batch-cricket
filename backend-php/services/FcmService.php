<?php
// backend-php/services/FcmService.php

class FcmService {
    private $projectId;
    private $serviceAccountPath;

    public function __construct() {
        $this->projectId = $_ENV['FCM_PROJECT_ID'] ?? $_SERVER['FCM_PROJECT_ID'] ?? getenv('FCM_PROJECT_ID');
        $this->serviceAccountPath = __DIR__ . '/../' . ($_ENV['GOOGLE_APPLICATION_CREDENTIALS'] ?? $_SERVER['GOOGLE_APPLICATION_CREDENTIALS'] ?? getenv('GOOGLE_APPLICATION_CREDENTIALS'));
    }

    /**
     * Generate OAuth2 Access Token using Service Account JSON
     */
    private function getAccessToken() {
        if (!file_exists($this->serviceAccountPath)) {
            error_log("Service account file not found: " . $this->serviceAccountPath);
            return null;
        }

        $json = json_decode(file_get_contents($this->serviceAccountPath), true);
        $token_uri = $json['token_uri'];
        $client_email = $json['client_email'];
        $private_key = $json['private_key'];

        $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
        $now = time();
        $payload = json_encode([
            'iss' => $client_email,
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => $token_uri,
            'exp' => $now + 3600,
            'iat' => $now
        ]);

        $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        $signature = '';
        openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $private_key, OPENSSL_ALGO_SHA256);
        $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $token_uri);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" . $jwt);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        
        $result = curl_exec($ch);
        curl_close($ch);

        $response = json_decode($result, true);
        return $response['access_token'] ?? null;
    }

    public function sendToTopic($topic, $title, $body, $dataArray = []) {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) return false;

        $url = "https://fcm.googleapis.com/v1/projects/{$this->projectId}/messages:send";
        
        $message = [
            'message' => [
                'topic' => $topic,
                'notification' => [
                    'title' => $title,
                    'body' => $body
                ],
                'data' => array_map('strval', $dataArray) // Ensure all data values are strings
            ]
        ];

        $headers = [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($message));

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("FCM Send Error ($httpCode): " . $result);
            return false;
        }

        return true;
    }
}
