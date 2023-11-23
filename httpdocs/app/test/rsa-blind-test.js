'use strict';

import {
  inverseMod,
  isCoprime,
  secureRandomBigIntUniform,
  getBitLength,
  bigIntModularExponentiation
} from '../js/rsa-blind.js';

(function() { // use an iife to avoid poluting the name space
  function test(desc, func) {
    const results = document.getElementById('results');
    const line = document.createElement('div');
    results.appendChild(line);
    try {
      func();
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
      assert(error.message === 'min must be less than or equal to max.');
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
    const bitLength = getBitLength(positiveBigInt);
    assert(bitLength === 61);
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
})();
