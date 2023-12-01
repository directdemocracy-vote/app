<?php
$private_key = openssl_get_privatekey('file://../../'.$folder.'id_rsa');
if ($private_key == FALSE)
  error('Failed to read private key');
$details = openssl_pkey_get_details($private_key);
$n = gmp_init('0x'.bin2hex($details['rsa']['n']));
$n2 = gmp_import($details['rsa']['n'], 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
if (gmp_cmp($n, $n2) === 0)
  die('OK');
else
  die('KO');
?>
