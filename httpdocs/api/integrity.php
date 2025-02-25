<?php
require_once '../../vendor/autoload.php';
require_once '../../php/header.php';

# Android dependencies
use Google\Client;
use Google\Service\PlayIntegrity;
use Google\Service\PlayIntegrity\DecodeIntegrityTokenRequest;

# iOS dependencies
use Firebase\JWT\JWT;
use Ramsey\Uuid\Uuid;

$DIRECTDEMOCRACY_VERSION_MAJOR = 2;
$DIRECTDEMOCRACY_VERSION_MINOR = 0;

function error($message) {
  die("{\"error\":\"$message\"}");
}

function stripped_key($public_key) {
  $stripped = str_replace('-----BEGIN PUBLIC KEY-----', '', $public_key);
  $stripped = str_replace('-----END PUBLIC KEY-----', '', $stripped);
  $stripped = str_replace(array("\r", "\n", '='), '', $stripped);
  return substr($stripped, 44, -6);
}

function get_type($schema) {
  $p = strrpos($schema, '/', 13);
  return substr($schema, $p + 1, strlen($schema) - $p - 13);  # remove the .schema.json suffix
}

$publication = json_decode(file_get_contents("php://input"));
if (!$publication)
  error('unable to parse JSON post');

$headers = getallheaders();
if (!isset($headers['Integrity-Token']))
  error('Unable to read Integrity-Token header: ');
$token = $headers['Integrity-Token'];

if (!isset($headers['Directdemocracy-Version']))
  error('Unable to read Directdemocracy-Version header');
$directdemocracyVersion = $headers['Directdemocracy-Version'];

$version = explode('.', explode(' ', $directdemocracyVersion)[0]);
if (intval($version[0]) !== $DIRECTDEMOCRACY_VERSION_MAJOR || intval($version[1]) !== $DIRECTDEMOCRACY_VERSION_MINOR)
  error("Wrong version set in DirectDemocracy-Version header: $version[0].$version[1].$version[2]");
$os = substr($directdemocracyVersion, strpos($directdemocracyVersion, '(', 6) + 1, -1);
if ($os !== 'iOS' && $os !== 'Android')
  error("Wrong os in DirectDemocracy-Version header: $os");

if (!isset($headers['User-Notary']))
  error('Unable to read User-Notary header');
$notary = $headers['User-Notary'];
if ('https://' . parse_url($notary, PHP_URL_HOST) !== $notary)
  error("Bad User-Notary header: $notary");

if (!isset($headers['App-Time']))
  error('Unable to read app-time header');
$time_difference = time() - intval($headers['App-Time']);
if (abs($time_difference) > 60)
  error("App-Time mismatches server time by $time_difference seconds"); 
# if the integrity check is successful, this means the publication is well formed because
# it was created by a geniune app, so we don't need to check it

$file = fopen('../../test/id_rsa.pub', 'r') or error('Failed to read test public key');
$test_public_key = fread($file, filesize('../../test/id_rsa.pub'));
fclose($file);
$file = fopen('../../id_rsa.pub', 'r') or error('Failed to read app public key');
$app_public_key = fread($file, filesize('../../id_rsa.pub'));
fclose($file);
if ($publication->appKey === stripped_key($test_public_key))
  $folder = 'test/';
elseif ($publication->appKey === stripped_key($app_public_key))
  $folder = '';
else
  error("Unknown app key ". stripped_key($test_public_key));

if ($os === 'Android') {
  $client = new Client();
  $client->setAuthConfig('../../directdemocracy.json');
  $client->addScope(PlayIntegrity::PLAYINTEGRITY);
  $service = new PlayIntegrity($client);
  $tokenRequest = new DecodeIntegrityTokenRequest();
  $tokenRequest->setIntegrityToken($token);
  $result = $service->v1->decodeIntegrityToken('vote.directdemocracy.app', $tokenRequest);        
  $verdict = $result->tokenPayloadExternal;
  $nonce = str_replace(array('_', '-', '='), array('/', '+', ''), $verdict->requestDetails->nonce);
  if ($nonce !== $publication->signature)
    error("Wrong nonce: $nonce  !==  $publication->signature");
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
    $failed = false;
    $message = '';
    foreach(array('MEETS_BASIC_INTEGRITY', 'MEETS_DEVICE_INTEGRITY', 'MEETS_STRONG_INTEGRITY') as &$check) {
      if (!in_array($check, $deviceRecognitionVerdict, true)) {
        $failed = true;
        $message .= '<br>❌ '.$check;
      } else
        $message .= '<br>✔️ '.$check;
    }
    if ($failed)
      error('Failed device integrity:'.$message);
  }
} else { # $os === 'iOS'
  if ($token === 'N/A' && $folder ==='')
    error('Bad N/A token for iOS');
  if ($token !== 'N/A') { # perform device check
    if ($folder === 'test/')
      error('Bad token for iOS simulator');
    $key = file_get_contents('../../AuthKey_2TPW39HHX8.p8');
    $jwt = JWT::encode(['iss' => 'LMJV45BD42', 'iat' => time()], $key, 'ES256', '2TPW39HHX8');
    $body = json_encode(['device_token' => $token,
                         'transaction_id' => Uuid::uuid4()->toString(),
                         'timestamp' => ceil(microtime(true)*1000)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $header = ['Authorization: Bearer '. $jwt, 'Content-Type: application/x-www-form-urlencoded', 'Content-Length: '.strlen($body)];
    $context = ['http' => ['method' => 'POST', 'header' => implode("\r\n", $header), 'content' => $body, 'ignore_errors' => true]];
    $answer = file_get_contents("https://api.devicecheck.apple.com/v1/validate_device_token", false, stream_context_create($context));
    if ($answer === false)
      error('Device check failed');
  }
}

if (isset($publication->schema)) { # this is a publication
  $private_key = openssl_get_privatekey('file://../../'.$folder.'id_rsa');
  if ($private_key == FALSE)
    error('Failed to read private key');
  if (isset($publication->encryptedVote)) {
    $encryptedVote = $publication->encryptedVote;
    unset($publication->encryptedVote);
  }
  $binarySignature = '';
  $success = openssl_sign($publication->signature, $binarySignature, $private_key, OPENSSL_ALGO_SHA256);
  if ($success === FALSE)
    error('Failed to sign publication');
  $publication->appSignature = substr(base64_encode($binarySignature), 0, -2);
  $type = get_type($publication->schema);
  if ($type !== 'participation') {
    if (isset($headers['Locality']) && isset($headers['Locality-Name']) && isset($headers['Latitude']) && isset($headers['Longitude'])) {
      $locality = $headers['Locality'];
      $localityName = $headers['Locality-Name'];
      $latitude = $headers['Latitude'];
      $longitude = $headers['Longitude'];
      $header = "locality: $locality\r\nlocality-name: $localityName\r\nlatitude: $latitude\r\nlongitude: $longitude\r\n";
    } else
      $header = "";
    $header .= "Content-Type: application/json\r\nAccept: application/json\r\n";
    $options = array('http' => array('method' => 'POST',
                                     'content' => json_encode($publication, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                                     'header' => $header));
    $context  = stream_context_create($options);
    die(file_get_contents("$notary/api/publish.php", false, $context));
  }
} else { # this is a challenge upload
  require_once '../../php/database.php';
  $mysqli->query("DELETE FROM challenge WHERE published < (NOW() - INTERVAL 10 MINUTE)") or die($mysqli->error);
  if (!isset($publication->key))
    error('Missing challenge key');
  if (!isset($publication->signature))
    error('Missing challenge signature');
  $key = $publication->key;
  $signature = $publication->signature;
  $query = "INSERT INTO challenge(`key`, signature) VALUES(FROM_BASE64('$key=='), FROM_BASE64('$signature=='))";
  $mysqli->query($query) or die($mysqli->error);
  $id = $mysqli->insert_id;
  $mysqli->close();
  die("{\"id\":$id}");
}
# from here we have a participation publication
# we need to store it in the database and publish it only after the referendum deadline

require_once '../../php/database.php';
$version = intval(explode('/', $publication->schema)[4]);
$query = "INSERT INTO participation(`version`, `key`, signature, published, appKey, appSignature, referendum, area) "
        ."VALUES($version, FROM_BASE64('$publication->key=='), FROM_BASE64('$publication->signature=='), FROM_UNIXTIME($publication->published), "
        ."FROM_BASE64('$publication->appKey=='), FROM_BASE64('$publication->appSignature=='), "
        ."FROM_BASE64('$publication->referendum=='), $publication->area) "
        ."ON DUPLICATE KEY UPDATE "
        ."`version`=$version, "
        ."signature=FROM_BASE64('$publication->signature=='), "
        ."appSignature=FROM_BASE64('$publication->appSignature==')";
$mysqli->query($query) or error($mysqli->error);
$mysqli->close();

# the signed participation has to be returned to the client app together with the blind signed vote
$details = openssl_pkey_get_details($private_key);
$n = gmp_import($details['rsa']['n'], 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
$e = gmp_import($details['rsa']['e'], 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
$d = gmp_import($details['rsa']['d'], 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
$blinded_message = gmp_import(base64_decode($encryptedVote), 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
$blind_signature = gmp_powm($blinded_message, $d, $n);
$m = gmp_powm($blind_signature, $e, $n);
if (gmp_cmp($m, $blinded_message) !== 0)
  error('Blind signature failed');
$answer = array('participation' => $publication, 'blind_signature' => base64_encode(gmp_export($blind_signature, 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST)));
die(json_encode($answer, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
?>
