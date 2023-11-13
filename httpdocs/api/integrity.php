<?php
require_once '../../vendor/autoload.php';

# Android dependencies
use Google\Client;
use Google\Service\PlayIntegrity;
use Google\Service\PlayIntegrity\DecodeIntegrityTokenRequest;

# iOS dependencies
use Zenstruck\JWT\Token;
use Zenstruck\JWT\Signer\OpenSSL\ECDSA\ES256;
use Ramsey\Uuid\Uuid;

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
if (!isset($citizen->os))
  error('Unable to read os');
$os = $citizen->os;

# if the integrity check is successful, this means the citizen blob is well formed because
# it was created by a geniune app, so we don't need to check it

$file = fopen('../../test/id_rsa.pub', 'r') or error('Failed to read test public key');
$test_public_key = fread($file, filesize('../../test/id_rsa.pub'));
fclose($file);
$file = fopen('../../id_rsa.pub', 'r') or error('Failed to read app public key');
$app_public_key = fread($file, filesize('../../id_rsa.pub'));
fclose($file);
if ($citizen->appKey === stripped_key($test_public_key))
  $folder = 'test/';
elseif ($citizen->appKey === stripped_key($app_public_key))
  $folder = '';
else
  error('Unknown app key');

if ($os === 'android') {
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
  if ($folder === '') {
    if ($verdict->appIntegrity->appRecognitionVerdict !== 'PLAY_RECOGNIZED')
      error('Failed app recognition check: ' . $verdict->appIntegrity->appRecognitionVerdict);
    if ($verdict->appIntegrity->packageName !== 'vote.directdemocracy.app')
      error('Failed app package name check: '. $verdict->appIntegrity->packageName);
    $deviceRecognitionVerdict = $verdict->deviceIntegrity->deviceRecognitionVerdict;
    if ($deviceRecognitionVerdict === null)
      error('No device recognition verdict');
    $s = sizeof($deviceRecognitionVerdict);
    if ($s === 0)
      error('Empty device recognition verdict');
    if ($s === 1)
      error('Insufficient device integrity: '.$deviceRecognitionVerdict[0]);
    if ($s === 2)
      error('Insufficent device integrity: '.$deviceRecognitionVerdict[0].' and '.$deviceRecognitionVerdict[1]);
    foreach(array('MEET_BASIC_INTEGRITY', 'MEETS_DEVICE_INTEGRITY', 'MEETS_STRONG_INTEGRITY') as &$check) {
      if (!in_array($check, $deviceRecognitionVerdict, true))
        error("Missing $check, found: ".$deviceRecognitionVerdict[0].', '.$deviceRecognitionVerdict[1].' and '.
              $deviceRecognitionVerdict[2]);
    }
  }
} elseif ($os === 'ios') {
  $token = new Token(['iss' => 'LMJV45BD42', 'iat' => time()], ['kid' => '2TPW39HHX8']);
  $jwt = (string)$token->sign(new ES256(), '../../AuthKey_2TPW39HHX8.p8');
  $body = json_encode(['device_token' => $token, 'transaction_id' => Uuid::uuid4()->toString(), 'timestamp' => ceil(microtime(true)*1000)]);
  $header = ['Authorization: Bearer '. $jwt, 'Content-Type: application/x-www-form-urlencoded', 'Content-Length: '.strlen($body)];
  $context = ['http' => ['method' => 'POST', 'header' => implode("\r\n", $header), 'content' => $body, 'ignore_errors' => true]];
  # FIXME, use https://api.devicecheck.apple.com for production
  $answer = file_get_contents("https://api.development.devicecheck.apple.com/v1/validate_device_token", false, stream_context_create($context));
  if ($answer === false)
    error('Device check failed');
} else
  error("Unknown OS: $os");

$private_key = openssl_get_privatekey('file://../../'.$folder.'id_rsa');
if ($private_key == FALSE)
  error('Failed to read private key');
$binarySignature = '';
$success = openssl_sign($citizen->signature, $binarySignature, $private_key, OPENSSL_ALGO_SHA256);
if ($success === FALSE)
  error('Failed to sign citizen');
$citizen->appSignature = base64_encode($binarySignature);
unset($citizen->token);
unset($citizen->os);
$notary = $citizen->notary;
unset($citizen->notary);
$options = array('http' => array('method' => 'POST',
                                 'content' => json_encode($citizen),
                                 'header' => "Content-Type: application/json\r\nAccept: application/json\r\n"));
$context  = stream_context_create($options);
die(file_get_contents("$notary/api/publish.php", false, $context));
?>
