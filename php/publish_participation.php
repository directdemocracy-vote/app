<?php
require_once('database.php');

$notary = 'https://notary.directdemocracy.vote';
$query = "SELECT * FROM participation WHERE published <= NOW()";
$result = $mysqli->query($query) or die($mysqli->error);
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
  print("publishing $row[id]...\n");
  $data = json_encode($participation, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $options = array('http' => array('method' => 'POST',
                                   'content' => $data,
                                   'ignore_errors' => true,
                                   'header' => "Content-Type: application/json\r\n" .
                                               "Accept: application/json\r\n"));
  $response = file_get_contents("$notary/api/publish.php", false, stream_context_create($options));
  print($response);
  print($http_response_header);
  $json = json_decode($response);
  if (json_last_error() !== JSON_ERROR_NONE)
    die($response);
  if (isset($json->error))
    die($json->error);
  $mysqli->query("DELETE FROM participation WHERE id=$row[id]");
}
$result->free();
print("done\n");
?>
