/** Base64URL without padding. */
export function base64url(data: Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buf.toString("base64url");
}

export function fromBase64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

const B58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58btc (Bitcoin alphabet) encode. */
export function base58btc(data: Uint8Array | Buffer): string {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const size = Math.ceil(((bytes.length - zeros) * 138) / 100) + 1;
  const buf = new Uint8Array(size);
  let length = 0;
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; k >= 0; k--, j++) {
      if (carry === 0 && j >= length) break;
      carry += buf[k] * 256;
      buf[k] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    length = j;
  }

  let it = size - length;
  while (it < size && buf[it] === 0) it++;
  let out = "1".repeat(zeros);
  for (; it < size; it++) out += B58_ALPHABET[buf[it]];
  return out;
}
