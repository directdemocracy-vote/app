<?php
require_once('../../php/database.php');

function error($message) {
  die("{\"error\":\"$message\"}");
}

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: content-type");

$notary = 'https://notary.directdemocracy.vote';
/*
$data = json_encode("{\"test\":1}");
$options = array('http' => array('method' => 'POST',
                                 'content' => $data,
                                 'ignore_errors' => true,
                                 'header' => "Content-Type: application/json\r\n"
                                            ."Accept: application/json\r\n"));
$response = file_get_contents("$notary/api/publish.php", false, stream_context_create($options));
die("{\"result\":\"$response\"}");
*/

$query = "SELECT * FROM participation WHERE published <= NOW()";
$result = $mysqli->query($query) or die($mysqli->error);
$list = '';
while ($row = $result->fetch_assoc()) {
  $participation = array(
    'schema' => "https://directdemocracy.vote/json-schema/$row[version]/participation.schema.json",
    'key' => $row['key'],
    'signature' => $row['signature'],
    'published' => strtotime($row['published']),
    'appKey' => $row['appKey'],
    'appSignature' => $row['appSignature'],
    'referendum' => $row['referendum'],
    'encryptedVote' => $row['encryptedVote']
  );
  $list .= $row['id'].', ';
  $data = json_encode($participation, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  # die($data);
  $data = "{\"test\":1}";
  $options = array('http' => array('method' => 'POST',
                                   'content' => $data,
                                   'ignore_errors' => true,
                                   'header' => "Content-Type: application/json\r\n"
                                              ."Accept: application/json\r\n"));
  $response = file_get_contents("$notary/api/publish.php", false, stream_context_create($options));
  $json = json_decode($response);
  if (json_last_error() !== JSON_ERROR_NONE)
    error($response);
  if (isset($json->error))
    error($json->error);
  error($response);
  $mysqli->query("DELETE FROM participation WHERE id=$row[id]");
}
$result->free();
$list = substr($list, 0, -2);
print("{\"published\": \"$list\"}");
?>
