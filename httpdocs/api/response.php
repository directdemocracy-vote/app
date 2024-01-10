<?php
if (!isset($_GET['id']))
  die('{"error":"missing id parameter"}');
if (!isset($_GET['key']))
  die('{"error":"missing key parameter"}');
if (!isset($_GET['signature']))
  die('{"error":"missing signature parameter"}');
require_once '../../php/sanitizer.php';
$id = intval($_GET['id']);
$key = sanitize_field($_GET['key'], 'base64', 'key');
$signature = sanitize_field($_GET['signature'], 'base64', 'signature');
require_once '../../php/database.php';
$query = "SELECT id FROM challenge WHERE id=$id AND `key`=FROM_BASE64('$key==') AND `signature`=FROM_BASE64('$signature==')";
$result = $mysqli->query($query) or die($mysqli->error);
$challenge = $result->fetch_assoc();
if (!$challenge)
  die('{"error":"challenge not found"}');
# from here we know that the request comes from the QR code owner client app
$file = "../../challenges/$id";
$counter = 0;
while (!file_exists($file)) {
  usleep(250000); # wait for 0.25 seconds
  $counter += 0.25;
  if ($counter >= 60) # die after one minute
    die('{"response":[]}');
}
$query = "SELECT REPLACE(REPLACE(TO_BASE64(`key`), '\\n', ''), '=', '') AS `key`, REPLACE(REPLACE(TO_BASE64(signature), '\\n', ''), '=', '') AS signature FROM response WHERE id=$id";
$mysqli->query("LOCK TABLES response WRITE");
$result = $mysqli->query($query) or die($mysqli->error);
$response = [];
$ids = '';
while($r = $result->fetch_assoc())
  $response[] = $r;
$r->free();
if (!$response) {
  $mysqli->query("UNLOCK TABLES");
  die('{"error":"missing response from database"}');
}
$mysqli->query("DELETE FROM response WHERE challenge=$id") or die($mysqli->error);
unlink($file);
$mysqli->query("UNLOCK TABLES");
$mysqli->close();
die('{"response":' . json_encode($response) . '}');
?>
