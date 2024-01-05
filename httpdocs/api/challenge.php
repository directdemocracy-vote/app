<?php
if (!isset($_GET['id']))
  die('{"error":"missing id parameter"}');
$id = intval($_GET['id']);
require_once '../../php/database.php';
$mysqli->query("DELETE FROM challenge WHERE published < (NOW() - INTERVAL 10 MINUTE)") or die($mysqli->error);
$query = "SELECT `key`, signature FROM challenge WHERE id=$id";
$r = $mysqli->query($query) or die($mysqli->error);
$challenge = $r->fetch_assoc();
$r->free();
$mysqli->close();
if (!$challenge)
  die('{"error":"challenge not found"}');
die('{"key":"'.$challenge['key'].'","signature":"'.$challenge['signature'].'"}');
?>
