'use strict';

class RSABlind {
  constructor(
    hash,
    hashOutputLength,
    generateMask,
    signerPublicKey
  ) {
    this.hash = hash;
    this.hashOutputLength = hashOutputLength;
    this.generateMask = generateMask;
    this.saltLen = 48; // as defined in https://datatracker.ietf.org/doc/html/rfc9474#name-rsabssa-variants for RSABSSA-SHA384-PSS-Randomized
    this.signerPublicKey = signerPublicKey;
  }

  /**
   * Creates a new instance of the RSABlind class with the SHA-384 hash function,
   * randomized PSS encoding.
   * @param {CryptoKey} singerPublicKey - The singer's public key as a string.
   * @returns {RSABlind} A new RSABlind instance with the specified parameters.
   */
  static async sha384PssRandomized(signerPublicKey) {
    const hashAlgorithm = 'SHA-384';
    const hash = (input) => hashToBytes(hashAlgorithm, input);
    const hashOutputLength = new TextEncoder().encode(hashAlgorithm).length;

    const hLen = hashFunction.length;
    const generateMask = (seed, maskLength) =>
      generateMGF1(seed, maskLength, hash, hashOutputLength);

    const publicKeyObj = await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );
    const modulus = base64urlToBigInt(publicKeyObj.n);
    const publicExponent = base64urlToBigInt(publicKeyObj.e);
    const modulusLength = signerPublicKey.algorithm.modulusLength;

    const publicKeyData = {
      modulus: modulus,
      publicExponent: publicExponent,
      modulusLength: modulusLength
    };

    return new RSABlind(
      hash,
      hashOutputLength,
      generateMask,
      publicKeyData
    );
  }

  /**
   * Prepares the message to be blind signed.
   * @param {string} message - The message to be blind signed.
   * @returns {Uint8Array} - The prepared unique vote.
   */
  prepare(message) {
    let textEncoder = new TextEncoder();
    const binaryMessage = textEncoder.encode(message);

    // Generate 32 bytes of random data
    const randomBytes = new Uint8Array(32);
    self.crypto.getRandomValues(randomBytes);

    // Concatenate the 32 random bytes with the binary message
    const prepared = new Uint8Array(32 + binaryMessage.length);
    prepared.set(randomBytes);
    prepared.set(binaryMessage, 32);
    return prepared;
  }

  /**
   * Blinds the vote using the polling station's public key.
   * @param {Uint8Array} prepared - The prepared message.
   * @returns {object} - An object containing the blinded unique vote and the unblinder.
   */
  blind(pkey, prepared) {
    // the modulus of the public key of the server has a binary length of 2048
    const encodedUniqueVote = this.#emsaPssEncode(prepared, 2048);
    const voteInteger = bytesToBigInt(encodedUniqueVote);
    if (!isCoprime(voteInteger, modulus)) {
      throw new Error(
        'invalid input: the voteInteger must be comprime with the modulus of the public key'
      );
    }
    const randomBigInt = secureRandomBigIntUniform(
      1,
      this.signerPublicKey.modulus
    );
    const unblindingKey = inverseMod(
      randomBigInt,
      this.signerPublicKey.modulus
    );
    const x = bigIntModularExponentiation(
      randomBigInt,
      this.signerPublicKey.publicExponent,
      this.signerPublicKey.modulus
    );
    const z = (m * x) % pk.n;

    // TODO: transform the resulting int z to bytes
    // TODO: Return the blinded message and the inverse
    return 0;
  }

  /**
   * Recovers the final signature from the blinded signature.
   * @param {string} publicKey - The polling station's public key.
   * @param {object} blindedUniqueVote - The blinded unique vote.
   * @param {object} blindSignature - The blind signature.
   * @returns {string} - The final signature.
   */
  finalize(publicKey, blindedUniqueVote, blindSignature) {
    // TODO
  }

  /**
   * Performs EMSA-PSS encoding for the given message.
   * @param {string} message - The message to be encoded.
   * @param {number} keySize - The size of the RSA key in bits.
   * @returns {Uint8Array} The encoded message.
   */
  #emsaPssEncode(message, keySize) {
    const messageHash = this.hash(message);
    const salt = new Uint8Array(this.saltLength);
    crypto.getRandomValues(salt);
    const mask = this.generateMask(messageHash, keySize - this.saltLength - 1);

    // XOR mask with hash
    const maskedHash = messageHash.clone();
    for (let i = 0; i < mask.words.length; i++)
      maskedHash.words[i] ^= mask.words[i];

    // Set the leftmost 8 * this.saltLength bits to zero
    maskedHash.words[0] &= 0xffffffff >>> (32 - 8 * this.saltLength);

    const encryptedMessage = salt.clone().concat(maskedHash);
    encryptedMessage.words[encryptedMessage.words.length - 1] |= 0x000000bc;
    return this.#convertWordArrayToUint8Array(encryptedMessage);
  }

  /**
   * Converts a CryptoJS WordArray to a Uint8Array of bytes.
   * @param {CryptoJS.lib.WordArray} wordArray - The WordArray to be converted.
   * @returns {Uint8Array} The Uint8Array containing the bytes from the WordArray.
   */
  #convertWordArrayToUint8Array(wordArray) {
    const len = wordArray.words.length;
    const uint8Array = new Uint8Array(len * 4);

    for (let i = 0, offset = 0; i < len; i++) {
      const word = wordArray.words[i];
      uint8Array[offset++] = (word >> 24) & 0xff;
      uint8Array[offset++] = (word >> 16) & 0xff;
      uint8Array[offset++] = (word >> 8) & 0xff;
      uint8Array[offset++] = word & 0xff;
    }

    return uint8Array;
  }
}

export function bytesToBigInt(x) { // converts a Uint8Array to a non-negative BigInt (OS2IP)
  const xLen = x.length;
  let output = 0n;
  for (let i = 0; i < xLen; i++)
    output += BigInt(x[xLen - 1 - i]) * 256n ** BigInt(i);
  return output;
}

export function isCoprime(a, b) { // Checks if two BigInt numbers are coprime (relatively prime)
  // Euclidean algorithm to find the greatest common divisor
  while (b !== 0n) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a === 1n;
}

export function secureRandomBigIntUniform(min, max) {
  // Generates a cryptographically secure random BigInt between min (inclusive) and max (inclusive)
  function log2BigInt(value) {
    // computes the base-2 logarithm (log2) of a BigInt
    if (value <= 0n)
      throw new Error('Value must be greater than 0.');
    let result = -1;
    while (value > 0n) {
      value >>= 1n; // Right-shift the value by 1 bit
      result++;
    }
    return result;
  }
  if (min > max)
    throw new Error('min must be less than or equal to max.');
  const range = max - min + 1n;
  // Generate random bytes
  const byteLength = Math.ceil(log2BigInt(range) / 8);
  const randomBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(randomBytes);
  // Convert random bytes to a BigInt
  let randomValue = 0n;
  for (let i = 0; i < byteLength; i++)
    randomValue = (randomValue << 8n) | BigInt(randomBytes[i]);
  randomValue = (randomValue % range) + min;
  return randomValue;
}

export function inverseMod(a, modulus) {
  a = ((a % modulus) + modulus) % modulus;
  if (modulus < 2n)
    return Error('invalid input: the modulus should be greater or equal to 2');
  // find the gcd
  const s = [];
  let b = modulus;
  while (b) {
    [a, b] = [b, a % b];
    s.push({ a, b });
  }
  if (a !== 1n)
    return Error('the inverse does not exist');
  // find the inverse
  let x = 1n;
  let y = 0n;
  for (let i = s.length - 2; i >= 0; --i)
    [x, y] = [y, x - y * (s[i].a / s[i].b)];
  return ((y % modulus) + modulus) % modulus;
}

export function bigIntToUint8Array(bigInt, arraySize) {
  const array = new Uint8Array(arraySize);
  const hex = bigInt.toString(16).padStart(2 * arraySize, '0');
  for (let i = 0; i < arraySize; i++)
    array[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return array;
}

export function base64ToBase64u(a) {
  a = a.replace(/=/g, '');
  a = a.replace(/\+/g, '-');
  a = a.replace(/\//g, '_');
  return a;
}

export function hexToBase64u(hexstring) {
  return base64ToBase64u(btoa(hexstring.match(/\w{2}/g).map(function(a) {
    return String.fromCharCode(parseInt(a, 16));
  }).join('')));
}

export function bitLength(bigInt) {
  return bigInt.toString(2).length;
}

export function bigIntModularExponentiation(base, exponent, modulus) {
  let result = 1n;
  base = base % modulus;
  while (exponent > 0n) {
    if (exponent % 2n === 1n)
      result = (result * base) % modulus;
    base = (base * base) % modulus;
    exponent = exponent / 2n;
  }
  return result;
}

export async function MGF1(mgfSeed, maskLen) {
  const hLen = 48;
  if (maskLen > Math.pow(2, 32) * hLen)
    throw new Error('mask too long');
  const max = Math.ceil(maskLen / hLen);
  let output = new Uint8Array(hLen * max);
  let offset = 0;
  for (let counter = 0; counter <= max - 1; counter++) {
    const c = new Uint8Array(4);
    c[0] = (counter >> 24) & 0xff;
    c[1] = (counter >> 16) & 0xff;
    c[2] = (counter >> 8) & 0xff;
    c[3] = counter & 0xff;
    const mgfSeedAndC = new Uint8Array(mgfSeed.length + c.length);
    mgfSeedAndC.set(mgfSeed);
    mgfSeedAndC.set(c, mgfSeed.length);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-384', mgfSeedAndC));
    output.set(hash, offset);
    offset += hash.length;
  }
  return output.slice(0, maskLen);
}

export async function emsaPssEncode(message, emBitLen, salt) {
  // In the POC of the RSA signature emBits is equals to bitLength(encodedMessage) - 1.
  // see https://github.com/cfrg/draft-irtf-cfrg-blind-signatures/blob/63ec6de689af673795ab39719c2b4cbd008bd863/poc/rsabssa.py#L47.
  // This implementation is similar to the POC.
  // Note that this is different from the original definition of emsaPssEncode (see https://www.rfc-editor.org/rfc/rfc8017#section-9.1.1)
  // where emBits is equals to bitLength(encodedMessage).
  const emBits = emBitLen - 1;
  const emLen = Math.ceil(emBits / 8);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-384', message));
  if (!salt) {
    salt = new Uint8Array(48);
    if (emLen < hash.length + salt.length + 2)
      throw new Error('emsaPssEncode encoding error');
    crypto.getRandomValues(salt);
  }
  const m = new Uint8Array(8 + hash.length + salt.length);
  m.set(new Uint8Array(8).fill(0));
  m.set(hash, 8);
  m.set(salt, 8 + hash.length);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-384', m));
  const ps = new Uint8Array(emLen - salt.length - hash.length - 2).fill(0);
  const db = new Uint8Array(emLen - hash.length - 1);
  db.set(ps);
  db.set(new Uint8Array([1]), ps.length);
  db.set(salt, ps.length + 1);
  const dbMask = await MGF1(h, emLen - hash.length - 1);
  const maskedDb = new Uint8Array(db.length);
  if (db.length !== maskedDb.length)
    console.error('Wrong db length: ' + db.length);
  for (let i = 0; i < db.length; i++)
    maskedDb[i] = db[i] ^ dbMask[i];
  const encodedMessage = new Uint8Array(maskedDb.length + h.length + 1);
  const mask = (0xff00 >> (8 * emLen - emBits) & 0xff);
  maskedDb[0] &= ~mask;
  encodedMessage.set(maskedDb);
  encodedMessage.set(h, maskedDb.length);
  encodedMessage.set(new Uint8Array([0xbc]), maskedDb.length + h.length);
  return encodedMessage;
}

/**
   * Converts a CryptoJS WordArray to a Uint8Array of bytes.
   * @param {CryptoKey} publicKey - The public key of the app.
   * @param {Uint8Array} message - The prepared message to be blind signed.
   * @param {Uint8Array} salt - The salt provided.
   * @returns {Uint8Array} message - The prepared message to be blind signed.
   */
export async function rsaBlind(publicKey, message) {
  function base64urlToBigInt(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    let hex = '';
    for (let i = 0; i < binary.length; i++)
      hex += ('00' + binary.charCodeAt(i).toString(16)).slice(-2);
    return BigInt(`0x${hex}`);
  }
  const publicKeyExport = await crypto.subtle.exportKey('jwk', publicKey);
  const nInt = base64urlToBigInt(publicKeyExport.n);
  const eInt = base64urlToBigInt(publicKeyExport.e);
  const salt = new Uint8Array(48);
  self.crypto.getRandomValues(salt);
  const emBitLen = bitLength(nInt);
  const result = await emsaPssEncode(message, emBitLen, salt);
  if (result.length !== message.length)
    console.error('emsaPssEncode size mismatch');
  const mInt = bytesToBigInt(result);
  if (!isCoprime(mInt, nInt))
    console.error('invalue input (isCoprime failed)');
  const rInt = secureRandomBigIntUniform(1n, nInt);
  const xInt = bigIntModularExponentiation(rInt, eInt, nInt);
  const zInt = (mInt * xInt) % nInt;
  return {
    'blinded_msg': bigIntToUint8Array(zInt, emBitLen / 8),
    'inv': inverseMod(rInt, nInt)
  };
}

export default RSABlind;
