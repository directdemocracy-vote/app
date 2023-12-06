'use strict';

import {
  inverseMod,
  isCoprime,
  secureRandomBigIntUniform,
  bitLength,
  bigIntModularExponentiation,
  bigIntToUint8Array,
  hexToBase64u,
  emsaPssEncode,
  emsaPssVerify,
  MGF1,
  bytesToBigInt
} from '../js/rsa-blind.js';

(async function() { // use an iife to avoid poluting the name space
  // Test vector for RSABSSA-SHA384-PSS-Randomized from https://datatracker.ietf.org/doc/html/rfc9474#appendix-A.1
  const inv = BigInt('0x80682c48982407b489d53d1261b19ec8627d02b8cda5336750b8cee332ae260de57b02d72609c1e0e9f28e2040fc65b6f0' +
    '2d56dbd6aa9af8fde656f70495dfb723ba01173d4707a12fddac628ca29f3e32340bd8f7ddb557cf819f6b01e445ad96f874ba235584ee71f6581f6' +
    '2d4f43bf03f910f6510deb85e8ef06c7f09d9794a008be7ff2529f0ebb69decef646387dc767b74939265fec0223aa6d84d2a8a1cc912d5ca25b4e1' +
    '44ab8f6ba054b54910176d5737a2cff011da431bd5f2a0d2d66b9e70b39f4b050e45c0d9c16f02deda9ddf2d00f3e4b01037d7029cd49c2d46a8e1f' +
    'c2c0c17520af1f4b5e25ba396afc4cd60c494a4c426448b35b49635b337cfb08e7c22a39b256dd032c00adddafb51a627f99a0e1704170ac1f1912e' +
    '49d9db10ec04c19c58f420212973e0cb329524223a6aa56c7937c5dffdb5d966b6cd4cbc26f3201dd25c80960a1a111b32947bb78973d269fac7f51' +
    '86530930ed19f68507540eed9e1bab8b00f00d8ca09b3f099aae46180e04e3584bd7ca054df18a1504b89d1d1675d0966c4ae1407be325cdf623cf1' +
    '3ff13e4a28b594d59e3eadbadf6136eee7a59d6a444c9eb4e2198e8a974f27a39eb63af2c9af3870488b8adaad444674f512133ad80b9220e091585' +
    '21614f1faadfe8505ef57b7df6813048603f0dd04f4280177a11380fbfc861dbcbd7418d62155248dad5fdec0991f');
  const n = 'aec4d69addc70b990ea66a5e70603b6fee27aafebd08f2d94cbe1250c556e047a928d635c3f45ee9b66d1bc628a03bac9b7c' +
    '3f416fe20dabea8f3d7b4bbf7f963be335d2328d67e6c13ee4a8f955e05a3283720d3e1f139c38e43e0338ad058a9495c53377fc35be64d208f89b4' +
    'aa721bf7f7d3fef837be2a80e0f8adf0bcd1eec5bb040443a2b2792fdca522a7472aed74f31a1ebe1eebc1f408660a0543dfe2a850f106a617ec668' +
    '5573702eaaa21a5640a5dcaf9b74e397fa3af18a2f1b7c03ba91a6336158de420d63188ee143866ee415735d155b7c2d854d795b7bc236cffd71542' +
    'df34234221a0413e142d8c61355cc44d45bda94204974557ac2704cd8b593f035a5724b1adf442e78c542cd4414fce6f1298182fb6d8e53cef1adfd' +
    '2e90e1e4deec52999bdc6c29144e8d52a125232c8c6d75c706ea3cc06841c7bda33568c63a6c03817f722b50fcf898237d788a4400869e44d90a302' +
    '0923dc646388abcc914315215fcd1bae11b1c751fd52443aac8f601087d8d42737c18a3fa11ecd4131ecae017ae0a14acfc4ef85b83c19fed33cfd1' +
    'cd629da2c4c09e222b398e18d822f77bb378dea3cb360b605e5aa58b20edc29d000a66bd177c682a17e7eb12a63ef7c2e4183e0d898f3d6bf567ba8' +
    'ae84f84f1d23bf8b8e261c3729e2fa6d07b832e07cddd1d14f55325c6f924267957121902dc19b3b32948bdead5';
  const e = '010001';
  const blindedMsg = 'aa3ee045138d874669685ffaef962c7694a9450aa9b4fd6465db9b' +
    '3b75a522bb921c4c0fdcdfae9667593255099cff51f5d3fd65e8ffb9d3b3036252a6' +
    'b51b6edfb3f40382b2bbf34c0055e4cbcc422850e586d84f190cd449af11dc65545f' +
    '5fe26fd89796eb87da4bda0c545f397cddfeeb56f06e28135ec74fd477949e7677f6' +
    'f36cfae8fd5c1c5898b03b9c244cf6d1a4fb7ad1cb43aff5e80cb462fac541e72f67' +
    'f0a50f1843d1759edfaae92d1a916d3f0efaf4d650db416c3bf8abdb5414a78cebc9' +
    '7de676723cb119e77aea489f2bbf530c440ebc5a75dccd3ebf5a412a5f346badd61b' +
    'ee588e5917bdcce9dc33c882e39826951b0b8276c6203971947072b726e935816056' +
    'ff5cb11a71ca2946478584126bb877acdf87255f26e6cca4e0878801307485d3b7bb' +
    '89b289551a8b65a7a6b93db010423d1406e149c87731910306e5e410b41d4da32346' +
    '24e74f92845183e323cf7eb244f212a695f8856c675fbc3a021ce649e22c6f0d053a' +
    '9d238841cf3afdc2739f99672a419ae13c17f1f8a3bc302ec2e7b98e8c353898b715' +
    '0ad8877ec841ea6e4b288064c254fefd0d049c3ad196bf7ffa535e74585d0120ce72' +
    '8036ed500942fbd5e6332c298f1ffebe9ff60c1e117b274cf0cb9d70c36ee4891528' +
    '996ec1ed0b178e9f3c0c0e6120885f39e8ccaadbb20f3196378c07b1ff22d10049d3' +
    '039a7a92fe7efdd95d';
  const encodedMsg = '2be01c5669eb676cb3f0002eb636427d61568f3f0579da5b998279' +
    'a7eb3ab784e5617319376d04809d83e72bef9f0738e7324af3fd1b4f0a35f4f58058' +
    'ab329495406bdb5ff31a0274be2d137c735ab0d5a591b3129a6cc46fcecc4b41dbc6' +
    '84c965cb30e3eb4864ef18cc8d95b4d6a2002607c821d4d8a7e026ae7bb1f6b4c7c9' +
    '3d1b58e9cd87864d6094b0d8f7e2b5f966473703634fb58c774dd4a24376e0eb262a' +
    '24b58e3a0b4da4f36ef75651627561ff2ecee9dcbfe1d728cc31a7b46030f7a2815a' +
    'e9edf9a2a5c0c6d8dbab1b33b9c3bbda5c083670a3550f7d74c4263aad09f8ed1d43' +
    '5fc6295ca4d51fc02c7de9ae28ffd53372c3fa864521b27560daa11ab9daad8d0d74' +
    '7661718d2f79c59d0661b09c74863fa32bdcb1c408d3bd24569c57aecae6e06c0c9d' +
    'eb7303c5b7b1240960fd2413d61b2e3829af8c09874fdba0fe84ca6aa7e7d533f9b0' +
    'ddfe508f562b132ca2d325f1e73f91a8a6b831a2fd9bc0bd5bfa5ea3a1dee16bd9b2' +
    '64174b9553a4c0c0d62373353355c05b35824e4bae702f49e5a6bf83eaff65af4990' +
    '45bcef1470a0e58ddb21856034af0db96f8636d4a6f1591f34c7224e0c0293e3d3be' +
    '2139f2797c5ed8b65473ac2f83c52b87f8cf8754ac2f55f5e41e105df1d079a647fb' +
    '1aa591526295667f37db1129752d024eb03bfe506a43665072118423351ef9b86633' +
    '76f9fc073141e1e7bc';
  const blindSig = '3f4a79eacd4445fca628a310d41e12fcd813c4d43aa4ef2b81226953248d6d00adfee6b79cb88bfa1f99270369fd' +
    '063c023e5ed546719b0b2d143dd1bca46b0e0e615fe5c63d95c5a6b873b8b50bc52487354e69c3dfbf416e7aca18d5842c89b676efdd38087008fa5' +
    'a810161fcdec26f20ccf2f1e6ab0f9d2bb93e051cb9e86a9b28c5bb62fd5f5391379f887c0f706a08bcc3b9e7506aaf02485d688198f5e22eefdf83' +
    '7b2dd919320b17482c5cc54271b4ccb41d267629b3f844fd63750b01f5276c79e33718bb561a152acb2eb36d8be75bce05c9d1b94eb609106f38226' +
    'fb2e0f5cd5c5c39c59dda166862de498b8d92f6bcb41af433d65a2ac23da87f39764cb64e79e74a8f4ce4dd567480d967cefac46b6e9c06434c3715' +
    '635834357edd2ce6f105eea854ac126ccfa3de2aac5607565a4e5efaac5eed491c335f6fc97e6eb7e9cea3e12de38dfb315220c0a3f84536abb2fdd' +
    '722813e083feda010391ac3d8fd1cd9212b5d94e634e69ebcc800c4d5c4c1091c64afc37acf563c7fc0a6e4c082bc55544f50a7971f3fb97d5853d7' +
    '2c3af34ffd5ce123998be5360d1059820c66a81e1ee6d9c1803b5b62af6bc877526df255b6d1d835d8c840bebbcd6cc0ee910f17da37caf8488afbc' +
    '08397a1941fcc79e76a5888a95b3d5405e13f737bea5c78d716a48eb9dc0aec8de39c4b45c6914ad4a8185969f70b1adf46';
  const sig = '191e941c57510e22d29afad257de5ca436d2316221fe870c7cb75205a6c071c2735aed0bc24c37f3d5bd960ab97a829a50' +
    '8f966bbaed7a82645e65eadaf24ab5e6d9421392c5b15b7f9b640d34fec512846a3100b80f75ef51064602118c1a77d28d938f6efc22041d60159a5' +
    '18d3de7c4d840c9c68109672d743d299d8d2577ef60c19ab463c716b3fa75fa56f5735349d414a44df12bf0dd44aa3e10822a651ed4cb0eb6f47c9b' +
    'd0ef14a034a7ac2451e30434d513eb22e68b7587a8de9b4e63a059d05c8b22c7c51e2cfee2d8bef511412e93c859a13726d87c57d1bc4c2e68ab121' +
    '562f839c3a3d233e87ed63c69b7e57525367753fbebcc2a9805a2802659f5888b2c69115bf865559f10d906c09d048a0d71bfee4b33857393ec2b69' +
    'e451433496d02c9a7910abb954317720bbde9e69108eafc3e90bad3d5ca4066d7b1e49013fa04e948104a1dd82b12509ecb146e948c54bd8bfb5e6d' +
    '18127cd1f7a93c3cf9f2d869d5a78878c03fe808a0d799e910be6f26d18db61c485b303631d3568368fc41986d08a95ea6ac0592240c19d7b22416b' +
    '9c82ae6241e211dd5610d0baaa9823158f9c32b66318f5529491b7eeadcaa71898a63bac9d95f4aa548d5e97568d744fc429104e32edd9c87519892' +
    'a198a30d333d427739ffb9607b092e910ae37771abf2adb9f63bc058bf58062ad456cb934679795bbdfcdfad5e0f2';
  const msg = '8f3dc6fb8c4a02f4d6352edf0907822c1210a9b32f9bdda4c45a698c80023aa6b59f8cfec5fdbb36331372ebefedae7d';
  const msgPrefix = '8417e699b219d583fb6216ae0c53ca0e9723442d02f1d1a34295527e7d929e8b';
  const preparedMsg = msgPrefix + msg;
  const salt = '051722b35f458781397c3a671a7d3bd3096503940e4c4f1aaa269d60300ce449555cd7340100df9d46944c5356825abf';

  async function test(desc, func) {
    const results = document.getElementById('results');
    const line = document.createElement('div');
    results.appendChild(line);
    try {
      await func();
      line.style.color = '#090'; // green
      line.innerHTML = '✔ ' + desc;
    } catch (error) {
      line.style.color = '#C00'; // red
      line.style.fontWeight = 'bold';
      line.innerHTML = '✘ ' + desc + '<br />⇒ ' + error;
    }
  }

  function assert(isTrue, failureMessage) {
    if (!isTrue)
      throw new Error(failureMessage || 'Assertion failed.');
  }

  test('modular multiplicative inverse simple case', function() {
    assert(inverseMod(3n, 11n) === 4n);
  });

  test('modular multiplicative inverse large modulus', function() {
    assert(inverseMod(5n, 999999999999n) === 200000000000n);
  });

  test('modular multiplicative inverse large numbers', function() {
    assert(inverseMod(1234567n, 9876543210n) === 1442441053n);
  });

  test('coprime BigInts', function() {
    assert(isCoprime(3n, 4n));
    assert(isCoprime(35n, 64n));
    assert(isCoprime(17n, 19n));
    assert(isCoprime(15n, 28n));
  });

  test('non-coprime BigInts', function() {
    assert(!isCoprime(6n, 9n));
    assert(!isCoprime(24n, 36n));
    assert(!isCoprime(20n, 25n));
    assert(!isCoprime(12n, 18n));
  });

  test('coprime BigInts with 1', function() {
    assert(isCoprime(1n, 7n));
    assert(isCoprime(3n, 1n));
    assert(isCoprime(1n, 1n));
  });

  test('secureRandomBigIntUniform: should generate a random BigInt within the specified range', function() {
    const min = 1000n;
    const max = 2000n;
    const randomValue = secureRandomBigIntUniform(min, max);
    assert(randomValue >= min);
    assert(randomValue <= max);
  });

  test('secureRandomBigIntUniform: should throw an error when min is greater than max', function() {
    const min = 2000n;
    const max = 1000n;
    try {
      secureRandomBigIntUniform(min, max);
      assert(false, 'Expected an error but got none.');
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message === 'min must be less than or equal to max');
    }
  });

  test('secureRandomBigIntUniform: should generate a random BigInt within a range of size one', function() {
    const value = 3n;
    const randomValue = secureRandomBigIntUniform(value, value);
    assert(randomValue === value);
  });

  test('secureRandomBigIntUniform: should handle a large range', function() {
    const min = 0n;
    const max = 1000000000000n;
    const randomValue = secureRandomBigIntUniform(min, max);
    assert(randomValue >= min);
    assert(randomValue <= max);
  });

  test('should calculate the bit length of a positive BigInt', function() {
    const positiveBigInt = 0x1bcdef1234567890n;
    const length = bitLength(positiveBigInt);
    assert(length === 61);
  });

  test('should calculate (2^3) % 5 correctly', function() {
    const base = 2n;
    const exponent = 3n;
    const modulus = 5n;
    const result = bigIntModularExponentiation(base, exponent, modulus);
    assert(result === 3n);
  });

  test('should handle (0^0) % 5 correctly', function() {
    const base = 0n;
    const exponent = 0n;
    const modulus = 5n;
    const result = bigIntModularExponentiation(base, exponent, modulus);
    assert(result === 1n); // Anything^0 % m = 1 for positive m
  });

  test('should handle (2^0) % 5 correctly', function() {
    const base = 2n;
    const exponent = 0n;
    const modulus = 5n;
    const result = bigIntModularExponentiation(base, exponent, modulus);
    assert(result === 1n); // Anything^0 % m = 1 for positive m
  });

  test('should calculate (12345678901234567890^2) % 7 correctly', function() {
    const base = 12345678901234567890n;
    const exponent = 2n;
    const modulus = 7n;
    const result = bigIntModularExponentiation(base, exponent, modulus);
    assert(result === 1n);
  });

  test('should handle large exponent values efficiently', function() {
    const base = 2n;
    const exponent = 123456789012345678901234567890n;
    const modulus = 5n;
    const result = bigIntModularExponentiation(base, exponent, modulus);
    assert(result === 4n);
  });

  await test('MGF1 with SHA-384', async function() {
    // test vector generated thanks to Python implementation at https://en.wikipedia.org/wiki/Mask_generation_function
    const seed = 'ce09df919320b17482c5cc54271b4ccb41d267629b3f849a32';
    const seedData = Uint8Array.from(seed.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const mask = 'ae30a2eaa0c53c23d340665851ab2abd37835a6572b1c11185acc8cee447e1b9';
    const maskData = Uint8Array.from(mask.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const mData = await MGF1(seedData, maskData.length);
    const m = Array.from(mData, i => i.toString(16).padStart(2, '0')).join('');
    assert(m === mask, 'MGF1 returned wrong mask');
  });

  await test('prepare and blind (test vector from RFC 9474)', async function() {
    const msgData = Uint8Array.from(preparedMsg.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const saltData = Uint8Array.from(salt.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const encodedMsgData = Uint8Array.from(encodedMsg.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const nInt = BigInt(`0x${n}`);
    const emBitLen = bitLength(nInt);
    const resultData = await emsaPssEncode(msgData, emBitLen, saltData);
    assert(resultData.length === encodedMsgData.length, 'emsaPssEncode size mismatch');
    const result = Array.from(resultData, i => i.toString(16).padStart(2, '0')).join('');
    assert(encodedMsg === result, 'failed to encode correct message with emsaPssEncode');
    const mInt = bytesToBigInt(resultData);
    assert(isCoprime(mInt, nInt), 'invalue input (isCoprime failed)');

    // Instead of generating 'r' randomly we retrieve it from 'inv'
    const rInt = inverseMod(inv, nInt);

    const eInt = BigInt(`0x${e}`);
    const xInt = bigIntModularExponentiation(rInt, eInt, nInt);
    const zInt = (mInt * xInt) % nInt;
    const blindedMsgData = bigIntToUint8Array(zInt, emBitLen / 8);
    const blindedMsgComputed = Array.from(blindedMsgData, i => i.toString(16).padStart(2, '0')).join('');
    assert(blindedMsg === blindedMsgComputed, 'failed to produce correct blindedMsg');
  });

  await test('finalize and verify (test vector from RFC 9474)', async function() {
    const sigData = Uint8Array.from(sig.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const msgData = Uint8Array.from(preparedMsg.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    assert(sigData.length === 512, 'unexpected input size: expecting 512, got ' + sigData.length);
    const bs = BigInt(`0x${blindSig}`);
    const s = (bs * inv) % BigInt(`0x${n}`);
    const signature = bigIntToUint8Array(s, 512);
    const keyData = { kty: 'RSA', e: hexToBase64u(e), n: hexToBase64u(n), alg: 'PS384', ext: true };
    const algorithm = { name: 'RSA-PSS', hash: { name: 'SHA-384' } };
    const publicKey = await crypto.subtle.importKey('jwk', keyData, algorithm, false, ['verify']);
    assert(publicKey, 'failed to create public key from exponent and modulus');
    const verify = await window.crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 48 }, publicKey, signature, msgData);
    assert(verify, 'failed to verify blind signature');
  });

  await test('verify (test vector from RFC 9474)', async function() {
    const nInt = BigInt(`0x${n}`);
    const eInt = BigInt(`0x${e}`);
    const msgData = Uint8Array.from(preparedMsg.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    const sInt = BigInt(`0x${sig}`);
    const mInt = bigIntModularExponentiation(sInt, eInt, nInt);
    const EM = bigIntToUint8Array(mInt, 512);
    const EMHex = Array.from(EM, i => i.toString(16).padStart(2, '0')).join('');
    assert(EMHex === encodedMsg, 'failed to compute encoded message');
    const modBits = 4 * n.length;
    const result = await emsaPssVerify(msgData, EM, modBits - 1);
    assert(result === 'consistent', 'invalid signature');
  });
})();
