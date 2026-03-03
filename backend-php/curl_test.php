<?php
// backend-php/curl_test.php

echo "<h2>Outbound Connectivity Test</h2>";

$url = "https://www.google.com";
echo "Testing connection to: $url<br>";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$result = curl_exec($ch);
$err = curl_error($ch);
$info = curl_getinfo($ch);

if ($result === false) {
    echo "<b style='color:red'>FAILED:</b> cURL Error: $err<br>";
} else {
    echo "<b style='color:green'>SUCCESS:</b> Received response from Google!<br>";
    echo "HTTP Code: " . $info['http_code'] . "<br>";
}

curl_close($ch);

echo "<br>---<br>";

$fcm_url = "https://fcm.googleapis.com/v1/projects/";
echo "Testing connection to FCM Endpoint: $fcm_url<br>";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $fcm_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$result = curl_exec($ch);
$err = curl_error($ch);
$info = curl_getinfo($ch);

if ($result === false) {
    echo "<b style='color:red'>FAILED:</b> cURL Error: $err<br>";
} else {
    echo "<b style='color:green'>SUCCESS:</b> FCM Endpoint is reachable!<br>";
    echo "HTTP Code: " . $info['http_code'] . " (Expected 404 since no project specified, but connection worked)<br>";
}

curl_close($ch);
