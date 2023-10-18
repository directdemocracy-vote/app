<?php
require_once '../../vendor/autoload.php';

use Google\Client;
use Google\Service\PlayIntegrity;
use Google\Service\PlayIntegrity\DecodeIntegrityTokenRequest;

$token = $_POST['token'];
$client = new Client();
$client->setAuthConfig('../../directdemocracy.json');
$client->addScope(PlayIntegrity::PLAYINTEGRITY);
$service = new PlayIntegrity($client);
$tokenRequest = new DecodeIntegrityTokenRequest();
$tokenRequest->setIntegrityToken($token);
$result = $service->v1->decodeIntegrityToken('vote.directdemocracy.app', $tokenRequest);        
$verdict = $result->tokenPayloadExternal;
$file = fopen("../../verdict.json", "w") or die("Unable to open file!");
fwrite($file, json_encode($verdict));
fclose($file);
?>