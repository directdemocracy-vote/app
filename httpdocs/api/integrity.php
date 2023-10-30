<?php
require_once '../../vendor/autoload.php';

use Google\Client;
use Google\Service\PlayIntegrity;
use Google\Service\PlayIntegrity\DecodeIntegrityTokenRequest;

function error($message) {
  die("{\"error\":\"$message\"}");
}

function stripped_key($public_key) {
  $stripped = str_replace('-----BEGIN PUBLIC KEY-----', '', $public_key);
  $stripped = str_replace('-----END PUBLIC KEY-----', '', $stripped);
  $stripped = str_replace("\r\n", '', $stripped);
  $stripped = str_replace("\n", '', $stripped);
  return $stripped;
}

$citizen = json_decode(file_get_contents("php://input"));
if (!$citizen)
  error('Unable to parse JSON post');
if (!isset($citizen->token))
  error('Unable to read token');
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
$file = fopen('../../verdict.json', 'w') or error('Unable to open verdict file!');
fwrite($file, json_encode($verdict));
fclose($file);
$nonce = str_replace('_', '/', str_replace('-', '+', $verdict->requestDetails->nonce));
if ($nonce !== $citizen->signature)
  error("Wrong nonce: $nonce  !==  $citizen->signature");
if ($verdict->requestDetails->requestPackageName !== 'vote.directdemocracy.app')
  error('Wrong package name');
$public_key_file = fopen('../../test/id_rsa.pub', 'r') or error('Failed to read public key');
$k = fread($public_key_file, filesize('../../test/id_rsa.pub'));
fclose($public_key_file);
if ($citizen->appKey !== stripped_key($k))
  error('Wrong appKey');
$private_key = openssl_get_privatekey('file://../../test/id_rsa');
if ($private_key == FALSE)
  error('Failed to read private key');
$appSignature = '';
$success = openssl_sign($citizen->signature, $appSignature, $private_key, OPENSSL_ALGO_SHA256);
if ($success === FALSE)
  error('Failed to sign citizen');
die("{\"appSignature\":\"$appSignature\"}");
?>