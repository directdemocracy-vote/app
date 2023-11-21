async function generateKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Public exponent 65537 (0x10001)
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKeyObj = await crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey
    );
    const modulus = base64urlToBigInt(publicKeyObj.n);
    const publicExponent = base64urlToBigInt(publicKeyObj.e);
    console.log(keyPair.publicKey.algorithm.modulusLength);
    console.log(publicKeyObj, modulus, publicExponent);
    console.log(publicExponent);
  } catch (error) {
    console.error("Error generating key pair:", error);
  }
}

function base64urlToBigInt(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  let hex = "";
  for (let i = 0; i < binary.length; i++) {
    hex += ("00" + binary.charCodeAt(i).toString(16)).slice(-2);
  }
  return BigInt(`0x${hex}`);
}

// Call the async function to generate the key pair
generateKeyPair();
console.log("tewst");
