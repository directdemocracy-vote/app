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
$file = "../../challenges/$id";
$counter = 0;
while (!file_exists($file)) {
  usleep(250000); # wait for 0.25 seconds
  $counter += 0.25;
  if ($counter >= 60) # die after one minute
    die('{"response":[]}');
}
require_once '../../php/database.php';
$query = "SELECT REPLACE(REPLACE(TO_BASE64(`key`), '\\n', ''), '=', '') AS `key`, REPLACE(REPLACE(TO_BASE64(signature), '\\n', ''), '=', '') AS signature FROM response WHERE id=$id";
$mysqli->query("LOCK TABLES response WRITE");
$r = $mysqli->query($query) or die($mysqli->error);
$answer = [];
$ids = '';
while($response = $r->fetch_assoc())
  $answer[] = $response;
$r->free();
if ($answer) {
  $mysqli->query("DELETE FROM response WHERE challenge=$id") or die($mysqli->error);
  unlink($file);
}
$mysqli->query("UNLOCK TABLES");
$mysqli->close();
die('{"key":"'.$challenge['key'].'","signature":"'.$challenge['signature'].'"}');
?>
