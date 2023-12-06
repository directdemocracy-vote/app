'use strict';

export function bytesToBigInt(x) { // converts a Uint8Array to a non-negative BigInt (OS2IP)
  const xLen = x.length;
  let output = 0n;
  for (let i = 0; i < xLen; i++)
    output += BigInt(x[xLen - 1 - i]) * 256n ** BigInt(i);
  return output;
}

export function isCoprime(a, b) { // Checks if two BigInt numbers are coprime (relatively prime)
  while (b !== 0n) { // Euclidean algorithm to find the greatest common divisor
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a === 1n;
}

export function secureRandomBigIntUniform(min, max) {
  // Generates a cryptographically secure random BigInt between min (inclusive) and max (inclusive)
  function log2BigInt(value) { // computes the base-2 logarithm (log2) of a BigInt
    if (value <= 0n)
      throw new Error('value must be greater than 0');
    let result = -1;
    while (value > 0n) {
      value >>= 1n; // Right-shift the value by 1 bit
      result++;
    }
    return result;
  }
  if (min > max)
    throw new Error('min must be less than or equal to max');
  const range = max - min + 1n;
  const byteLength = Math.ceil(log2BigInt(range) / 8);
  const randomBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(randomBytes);
  return bytesToBigInt(randomBytes) % range + min;
}

export function inverseMod(a, modulus) {
  a = ((a % modulus) + modulus) % modulus;
  if (modulus < 2n)
    throw new Error('invalid input: the modulus should be greater or equal to 2');
  // find the gcd
  const s = [];
  let b = modulus;
  while (b) {
    [a, b] = [b, a % b];
    s.push({ a, b });
  }
  if (a !== 1n)
    throw new Error('the inverse does not exist');
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

function base64uToBinary(base64u) {
  const base64 = base64u.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

function base64uToBigInt(base64u) {
  const binary = base64uToBinary(base64u);
  let hex = '';
  for (let i = 0; i < binary.length; i++)
    hex += ('00' + binary.charCodeAt(i).toString(16)).slice(-2);
  return BigInt(`0x${hex}`);
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
    throw new Error('wrong db length: ' + db.length);
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

export async function emsaPssVerify(M, EM, emBits) {
  const mHash = new Uint8Array(await crypto.subtle.digest('SHA-384', M));
  if (EM.length < mHash.length + 48 + 2)
    return 'inconsistent';
  if (EM[EM.length - 1] !== 0xbc)
    return 'inconsistent';
  const maskedDB = EM.slice(0, EM.length - mHash.length - 1);
  const H = EM.slice(EM.length - mHash.length - 1, EM.length - 1);
  const mask = (0xff00 >> (8 * EM.length - emBits) & 0xff);
  if (maskedDB[0] & mask)
    return 'inconsitent';
  const dbMask = await MGF1(H, EM.length - mHash.length - 1);
  const db = new Uint8Array(dbMask.length);
  for (let i = 0; i < db.length; i++)
    db[i] = maskedDB[i] ^ dbMask[i];
  db[0] &= 0x7f;
  const leftmost = EM.length - mHash.length - 48 - 2;
  for (let i = 0; i < leftmost; i++) {
    if (db[i])
      return 'inconsistent';
  }
  if (db[leftmost] !== 1)
    return 'inconsistent';
  const mp = new Uint8Array(8 + mHash.length + 48);
  mp.set(new Uint8Array(8).fill(0));
  mp.set(mHash, 8);
  mp.set(db.slice(-48), 8 + mHash.length);
  const hp = new Uint8Array(await crypto.subtle.digest('SHA-384', mp));
  if (!H.every((value, index) => value === hp[index]))
    return 'inconsistent';
  return 'consistent';
}

/**
   * prepare a message to be blind signed by the owner of a RSA public key.
   * Note: the message should already be prepared and include the random part (see RFC 9474).
   * @param {CryptoKey} publicKey - The public key.
   * @param {Uint8Array} message - The prepared message to be blind signed.
   * @param {Uint8Array} salt - The salt provided.
   * @returns {Uint8Array, BigInt} {blindMessage, inv} - The prepared message to be blind signed and the inv key
   */
export async function rsaBlind(publicKey, message, salt) {
  const publicKeyExport = await crypto.subtle.exportKey('jwk', publicKey);
  const nInt = base64uToBigInt(publicKeyExport.n);
  const eInt = base64uToBigInt(publicKeyExport.e);
  if (salt === undefined) {
    salt = new Uint8Array(48);
    self.crypto.getRandomValues(salt);
  }
  const emBitLen = bitLength(nInt);
  const result = await emsaPssEncode(message, emBitLen, salt);
  if (result.length !== emBitLen / 8)
    throw new Error('emsaPssEncode size mismatch');
  const mInt = bytesToBigInt(result);
  if (!isCoprime(mInt, nInt))
    throw new Error('isCoprime failed');
  const rInt = secureRandomBigIntUniform(1n, nInt);
  const xInt = bigIntModularExponentiation(rInt, eInt, nInt);
  const zInt = (mInt * xInt) % nInt;
  return {
    blindMessage: bigIntToUint8Array(zInt, emBitLen / 8),
    inv: inverseMod(rInt, nInt)
  };
}

/**
   * unblind a blindly signed message and verify it (see RFC 9474 - finalize).
   * @param {CryptoKey} publicKey - The public key.
   * @param {Uint8Array} blindMessage - The prepared message which was blind signed.
   * @param {Uint8Array} blindSignature - The blind signature.
   * @param {BigInt} inv - The decoding key.
   * @returns {Uint8Array} signature - The unblinded signature.
   */
export async function rsaUnblind(publicKey, blindMessage, blindSignature, inv) {
  if (blindSignature.length !== 256 && blindSignature.length !== 512)
    throw new Error('unexpected blind signature size: expecting 256 or 512, got ' + blindSignature.length);
  const publicKeyExport = await crypto.subtle.exportKey('jwk', publicKey);
  const nInt = base64uToBigInt(publicKeyExport.n);
  const s = (bytesToBigInt(blindSignature) * inv) % nInt;
  const signature = bigIntToUint8Array(s, base64uToBinary(publicKeyExport.n).length);
  const keyData = {
    kty: 'RSA',
    e: base64ToBase64u(publicKeyExport.e),
    n: base64ToBase64u(publicKeyExport.n),
    alg: 'PS384',
    ext: true
  };
  const algorithm = { name: 'RSA-PSS', hash: { name: 'SHA-384' } };
  const ps384Key = await crypto.subtle.importKey('jwk', keyData, algorithm, false, ['verify']);
  if (!ps384Key)
    throw new Error('failed to create public key from exponent and modulus');
  const verify = await window.crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 48 }, ps384Key, signature, blindMessage);
  if (!verify)
    throw new Error('failed to verify blind signature');
  return signature;
}
