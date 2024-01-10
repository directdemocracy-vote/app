<?php
if (!isset($_GET['id']))
  die('{"error":"missing id parameter"}');
$id = intval($_GET['id']);
require_once '../../php/database.php';
$mysqli->query("DELETE FROM challenge WHERE published < (NOW() - INTERVAL 10 MINUTE)") or die($mysqli->error);
$query = "SELECT REPLACE(REPLACE(TO_BASE64(`key`), '\\n', ''), '=', '') AS `key`, REPLACE(REPLACE(TO_BASE64(signature), '\\n', ''), '=', '') AS signature FROM challenge WHERE id=$id";
$r = $mysqli->query($query) or die($mysqli->error);
$challenge = $r->fetch_assoc();
$r->free();
$mysqli->close();
if ($challenge) {
  die('{"key":"'.$challenge['key'].'","signature":"'.$challenge['signature'].'"}');
}
die('{"error":"challenge not found"}');

?>
