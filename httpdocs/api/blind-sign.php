<?php

# Test vector for RSABSSA-SHA384-PSS-Randomized from https://datatracker.ietf.org/doc/html/rfc9474#appendix-A.1
$test_n           = 'aec4d69addc70b990ea66a5e70603b6fee27aafebd08f2d94cbe1250c556e047a928d635c3f45ee9b66d1bc628a03bac9b7c3f416fe20dabea8f3d7b4bbf7f963be335d2328d67e6c13ee4a8f955e05a3283720d3e1f139c38e43e0338ad058a9495c53377fc35be64d208f89b4aa721bf7f7d3fef837be2a80e0f8adf0bcd1eec5bb040443a2b2792fdca522a7472aed74f31a1ebe1eebc1f408660a0543dfe2a850f106a617ec6685573702eaaa21a5640a5dcaf9b74e397fa3af18a2f1b7c03ba91a6336158de420d63188ee143866ee415735d155b7c2d854d795b7bc236cffd71542df34234221a0413e142d8c61355cc44d45bda94204974557ac2704cd8b593f035a5724b1adf442e78c542cd4414fce6f1298182fb6d8e53cef1adfd2e90e1e4deec52999bdc6c29144e8d52a125232c8c6d75c706ea3cc06841c7bda33568c63a6c03817f722b50fcf898237d788a4400869e44d90a3020923dc646388abcc914315215fcd1bae11b1c751fd52443aac8f601087d8d42737c18a3fa11ecd4131ecae017ae0a14acfc4ef85b83c19fed33cfd1cd629da2c4c09e222b398e18d822f77bb378dea3cb360b605e5aa58b20edc29d000a66bd177c682a17e7eb12a63ef7c2e4183e0d898f3d6bf567ba8ae84f84f1d23bf8b8e261c3729e2fa6d07b832e07cddd1d14f55325c6f924267957121902dc19b3b32948bdead5';
$test_e           = '010001';
$test_d           = '0d43242aefe1fb2c13fbc66e20b678c4336d20b1808c558b6e62ad16a287077180b177e1f01b12f9c6cd6c52630257ccef26a45135a990928773f3bd2fc01a313f1dac97a51cec71cb1fd7efc7adffdeb05f1fb04812c924ed7f4a8269925dad88bd7dcfbc4ef01020ebfc60cb3e04c54f981fdbd273e69a8a58b8ceb7c2d83fbcbd6f784d052201b88a9848186f2a45c0d2826870733e6fd9aa46983e0a6e82e35ca20a439c5ee7b502a9062e1066493bdadf8b49eb30d9558ed85abc7afb29b3c9bc644199654a4676681af4babcea4e6f71fe4565c9c1b85d9985b84ec1abf1a820a9bbebee0df1398aae2c85ab580a9f13e7743afd3108eb32100b870648fa6bc17e8abac4d3c99246b1f0ea9f7f93a5dd5458c56d9f3f81ff2216b3c3680a13591673c43194d8e6fc93fc1e37ce2986bd628ac48088bc723d8fbe293861ca7a9f4a73e9fa63b1b6d0074f5dea2a624c5249ff3ad811b6255b299d6bc5451ba7477f19c5a0db690c3e6476398b1483d10314afd38bbaf6e2fbdbcd62c3ca9797a420ca6034ec0a83360a3ee2adf4b9d4ba29731d131b099a38d6a23cc463db754603211260e99d19affc902c915d7854554aabf608e3ac52c19b8aa26ae042249b17b2d29669b5c859103ee53ef9bdc73ba3c6b537d5c34b6d8f034671d7f3a8a6966cc4543df223565343154140fd7391c7e7be03e241f4ecfeb877a051';
$test_blinded_msg = 'aa3ee045138d874669685ffaef962c7694a9450aa9b4fd6465db9b3b75a522bb921c4c0fdcdfae9667593255099cff51f5d3fd65e8ffb9d3b3036252a6b51b6edfb3f40382b2bbf34c0055e4cbcc422850e586d84f190cd449af11dc65545f5fe26fd89796eb87da4bda0c545f397cddfeeb56f06e28135ec74fd477949e7677f6f36cfae8fd5c1c5898b03b9c244cf6d1a4fb7ad1cb43aff5e80cb462fac541e72f67f0a50f1843d1759edfaae92d1a916d3f0efaf4d650db416c3bf8abdb5414a78cebc97de676723cb119e77aea489f2bbf530c440ebc5a75dccd3ebf5a412a5f346badd61bee588e5917bdcce9dc33c882e39826951b0b8276c6203971947072b726e935816056ff5cb11a71ca2946478584126bb877acdf87255f26e6cca4e0878801307485d3b7bb89b289551a8b65a7a6b93db010423d1406e149c87731910306e5e410b41d4da3234624e74f92845183e323cf7eb244f212a695f8856c675fbc3a021ce649e22c6f0d053a9d238841cf3afdc2739f99672a419ae13c17f1f8a3bc302ec2e7b98e8c353898b7150ad8877ec841ea6e4b288064c254fefd0d049c3ad196bf7ffa535e74585d0120ce728036ed500942fbd5e6332c298f1ffebe9ff60c1e117b274cf0cb9d70c36ee4891528996ec1ed0b178e9f3c0c0e6120885f39e8ccaadbb20f3196378c07b1ff22d10049d3039a7a92fe7efdd95d';
$test_blind_sig   = '3f4a79eacd4445fca628a310d41e12fcd813c4d43aa4ef2b81226953248d6d00adfee6b79cb88bfa1f99270369fd063c023e5ed546719b0b2d143dd1bca46b0e0e615fe5c63d95c5a6b873b8b50bc52487354e69c3dfbf416e7aca18d5842c89b676efdd38087008fa5a810161fcdec26f20ccf2f1e6ab0f9d2bb93e051cb9e86a9b28c5bb62fd5f5391379f887c0f706a08bcc3b9e7506aaf02485d688198f5e22eefdf837b2dd919320b17482c5cc54271b4ccb41d267629b3f844fd63750b01f5276c79e33718bb561a152acb2eb36d8be75bce05c9d1b94eb609106f38226fb2e0f5cd5c5c39c59dda166862de498b8d92f6bcb41af433d65a2ac23da87f39764cb64e79e74a8f4ce4dd567480d967cefac46b6e9c06434c3715635834357edd2ce6f105eea854ac126ccfa3de2aac5607565a4e5efaac5eed491c335f6fc97e6eb7e9cea3e12de38dfb315220c0a3f84536abb2fdd722813e083feda010391ac3d8fd1cd9212b5d94e634e69ebcc800c4d5c4c1091c64afc37acf563c7fc0a6e4c082bc55544f50a7971f3fb97d5853d72c3af34ffd5ce123998be5360d1059820c66a81e1ee6d9c1803b5b62af6bc877526df255b6d1d835d8c840bebbcd6cc0ee910f17da37caf8488afbc08397a1941fcc79e76a5888a95b3d5405e13f737bea5c78d716a48eb9dc0aec8de39c4b45c6914ad4a8185969f70b1adf46';
$test_prep_msg    = '8417e699b219d583fb6216ae0c53ca0e9723442d02f1d1a34295527e7d929e8b8f3dc6fb8c4a02f4d6352edf0907822c1210a9b32f9bdda4c45a698c80023aa6b59f8cfec5fdbb36331372ebefedae7d';
$test_encoded_msg = '2be01c5669eb676cb3f0002eb636427d61568f3f0579da5b998279a7eb3ab784e5617319376d04809d83e72bef9f0738e7324af3fd1b4f0a35f4f58058ab329495406bdb5ff31a0274be2d137c735ab0d5a591b3129a6cc46fcecc4b41dbc684c965cb30e3eb4864ef18cc8d95b4d6a2002607c821d4d8a7e026ae7bb1f6b4c7c93d1b58e9cd87864d6094b0d8f7e2b5f966473703634fb58c774dd4a24376e0eb262a24b58e3a0b4da4f36ef75651627561ff2ecee9dcbfe1d728cc31a7b46030f7a2815ae9edf9a2a5c0c6d8dbab1b33b9c3bbda5c083670a3550f7d74c4263aad09f8ed1d435fc6295ca4d51fc02c7de9ae28ffd53372c3fa864521b27560daa11ab9daad8d0d747661718d2f79c59d0661b09c74863fa32bdcb1c408d3bd24569c57aecae6e06c0c9deb7303c5b7b1240960fd2413d61b2e3829af8c09874fdba0fe84ca6aa7e7d533f9b0ddfe508f562b132ca2d325f1e73f91a8a6b831a2fd9bc0bd5bfa5ea3a1dee16bd9b264174b9553a4c0c0d62373353355c05b35824e4bae702f49e5a6bf83eaff65af499045bcef1470a0e58ddb21856034af0db96f8636d4a6f1591f34c7224e0c0293e3d3be2139f2797c5ed8b65473ac2f83c52b87f8cf8754ac2f55f5e41e105df1d079a647fb1aa591526295667f37db1129752d024eb03bfe506a43665072118423351ef9b8663376f9fc073141e1e7bc';

# In practice, we should use openssl_pkey_get_details() to retrieve the n, e, d components of our private key

function blind_sign($blinded_msg, $n, $e, $d) {
  $blind_sig = gmp_powm($blinded_msg, $d, $n);
  $m = gmp_powm($blind_sig, $e, $n);
  if (gmp_cmp($m, $blinded_msg) !== 0) {
    print("Signing failure<br>\n");
    return 0;
  }
  return $blind_sig;
}

function gmp2hex($n) {
  return bin2hex(gmp_export($n, 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST));
}

function blind_verify($n, $e, $msg, $signature) {
  global $test_encoded_msg;
  $n_bytes = gmp_export($n, 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
  if (strlen($n_bytes) !== strlen($signature) / 2)
    die("mismatch length for n and signature");
  $s = gmp_init("0x$signature");
  if (gmp_cmp($s, 0) <= 0)
    die("failed to verify (1)");
  if (gmp_cmp($s, $n) > 0)
    die("failed to verify (2)");
  $m = gmp_powm($s, $e, $n);
  $modBits = strlen($n_bytes) * 8;
  $emLen = intval(ceil(($modBits - 1) / 8));
  print('<pre>');
  print('s = '.gmp2hex($s)."\n");
  print('e = '.gmp2hex($e)."\n");
  print('n = '.gmp2hex($n)."\n");
  print('m = '.gmp2hex($m)."\n");
  print("modBits = $modBits\n");
  print("emLen = $emLen\n");
  $em = gmp_export($m, 1, GMP_BIG_ENDIAN | GMP_MSW_FIRST);
  print("em = $test_encoded_msg\n");
  if (strcmp($em, hex2bin($test_encoded_msg)) !== 0)
    print("wrong encoded message:\n".bin2hex($em)."\n$test_encoded_msg");
  if (strlen($em) !== $emLen)
    print("emLen mismatch: ".strlen($em)." !== $emLen");
  if ($em[$emLen - 1] != 0xbc)
    print("inconsistent rightmost octet: ".bin2hex($em[$emLen - 1])."<br>\n".bin2hex($em));
  $mHash = hash('sha384', hex2bin($msg));
  $sLen = 48;
  if ($emLen < strlen($mHash) + $sLen + 2)
    print("inconsistent: $emLen < ".strlen($mHash)." + $sLen + 2");
  print('</pre>');
  return false;
}

$n = gmp_init("0x$test_n");
$e = gmp_init("0x$test_e");
$d = gmp_init("0x$test_d");
$blinded_msg = gmp_init("0x$test_blinded_msg");
$blind_sig = gmp_init("0x$test_blind_sig");

if (gmp_cmp(blind_sign($blinded_msg, $n, $e, $d), $blind_sig) !== 0)
  die("Failed to sign");

if (!blind_verify($n, $e, $test_prep_msg, $test_blind_sig))
  die("Failed to verify");

die("Success");

?>
