<?php # Use openssl_pkey_get_details() to retrieve the n, e, d components of a private key

function blind_sign($blinded_msg, $n, $e, $d) {
  $blind_sig = gmp_powm($blinded_msg, $d, $n);
  $m = gmp_powm($blind_sig, $e, $n);
  if (gmp_cmp($m, $blinded_msg) !== 0)
    return false;
  return $blind_sig;
}

function MGF1($mgfSeed, $maskLen) {
  $max = ceil($maskLen / 48);
  $output = '';
  for($counter = 0; $counter <= $max; $counter++) {
    $c = chr(($counter >> 24) & 0xff).chr(($counter >> 16) & 0xff).chr(($counter >> 8) & 0xff).chr($counter & 0xff);
    $mgfSeedAndC = $mgfSeed.$c;
    $hash = hash('sha384', $mgfSeedAndC, true);
    $output .= $hash;
  }
  return substr($output, 0, $maskLen);
}

function blind_verify($n, $e, $msg, $signature) {
  global $test_encoded_msg;
  $n_bytes = gmp_export($n, 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
  if (strlen($n_bytes) !== strlen($signature) / 2)
    return "mismatch length for n and signature";
  $s = gmp_init("0x$signature");
  $m = gmp_powm($s, $e, $n);
  $modBits = strlen($n_bytes) * 8;
  $emLen = intval(ceil(($modBits - 1) / 8));
  $em = gmp_export($m, 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
  if (strcmp($em, hex2bin($test_encoded_msg)) !== 0)
    return "wrong encoded message";
  if (strlen($em) !== $emLen)
    return "emLen mismatch: ".strlen($em)." !== $emLen";
  $mHash = hash('sha384', hex2bin($msg), true);
  $hLen = strlen($mHash);
  $sLen = 48;
  if ($emLen < strlen($mHash) + $sLen + 2)
    return "inconsistent: $emLen < ".strlen($mHash)." + $sLen + 2";
  if (ord($em[$emLen - 1]) !== 0xbc)
    return "inconsistent rightmost octet";
  $maskedDB = substr($em, 0, $emLen - $hLen - 1);
  $H = substr($em, $emLen - $hLen - 1, $hLen);
  $mask = (0xff00 >> (8 * $emLen - $modBits + 1) & 0xff);
  if ((ord($maskedDB[0]) & $mask) != 0)
    return "zero bit test failed";
  $dbMask = MGF1($H, $emLen - $hLen - 1);
  $db = '';
  $max = $emLen - $hLen - 1;
  for($i = 0; $i < $max; $i++)
    $db .= $maskedDB[$i] ^ $dbMask[$i];
  $db[0] = chr(ord($db[0]) & 0x7f);
  $leftmost = $emLen - $hLen - 48 - 2;
  for($i = 0; $i < $leftmost; $i++)
    if (ord($db[$i]) !== 0)
      return "zero bytes test failed";
  if (ord($db[$leftmost]) !== 1)
    return "one byte test failed";
  $mp = str_repeat(chr(0), 8);
  $mp .= $mHash;
  $mp .= substr($db, -48);
  $hp = hash('sha384', $mp, true);
  if ($hp !== $H)
    return "inconsistent";
  return "";
}
?>
