import hashlib

def mgf1(seed: bytes, length: int, hash_func=hashlib.sha384) -> bytes:
    """Mask generation function."""
    hLen = hash_func().digest_size
    if length > (hLen << 32):
        raise ValueError("mask too long")
    T = b""
    counter = 0
    while len(T) < length:
        C = int.to_bytes(counter, 4, "big")
        T += hash_func(seed + C).digest()
        counter += 1
    return T[:length]


print(mgf1(bytes.fromhex('ce09df919320b17482c5cc54271b4ccb41d267629b3f849a32'), 32, hashlib.sha384).hex())
