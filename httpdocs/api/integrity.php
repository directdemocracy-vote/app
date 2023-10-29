<?php
require_once '../../vendor/autoload.php';

use Google\Client;
use Google\Service\PlayIntegrity;
use Google\Service\PlayIntegrity\DecodeIntegrityTokenRequest;

$citizen = json_decode(file_get_contents("php://input"));
if (!$citizen)
  die('Unable to parse JSON post');
if (!isset($citizen->token))
  die('Unable to read token');
$token = $citizen->token;

# if the integrity check is successful, this means the citizen blob is well formed because
# it was created by a geniune app, so we don't need to check it
$client = new Client();
$client->setAuthConfig('../../directdemocracy.json');
$client->addScope(PlayIntegrity::PLAYINTEGRITY);
$service = new PlayIntegrity($client);
$tokenRequest = new DecodeIntegrityTokenRequest();
$tokenRequest->setIntegrityToken($token);
$result = $service->v1->decodeIntegrityToken('vote.directdemocracy.app', $tokenRequest);        
$verdict = $result->tokenPayloadExternal;
$file = fopen('../../verdict.json', 'w') or die('Unable to open verdict file!');
fwrite($file, json_encode($verdict));
fclose($file);
if ($verdict->requestDetails->nonce !== $citizen->signature)
  die('Wrong nonce');
if ($verdict->requestDetails->packageName !== 'vote.directdemocracy.app')
  die('Wrong package name');

$public_key_file = fopen('../../test/id_rsa.pub', 'r') or die('Failed to read public key');
$k = fread($public_key_file, filesize('../../test/id_rsa.pub'));
fclose($public_key_file);
if ($citizen->appKey !== stripped_key($k))
  die('Wrong appKey');
$private_key = openssl_get_privatekey('file://../../test/id_rsa');
if ($private_key == FALSE)
  die('Failed to read private key');
$appSignature = '';
$success = openssl_sign($citizen->signature, $appSignature, $private_key, OPENSSL_ALGO_SHA256);
if ($success === FALSE)
  die('Failed to sign citizen');
die('{"appSignature":$appSignature}');
?>