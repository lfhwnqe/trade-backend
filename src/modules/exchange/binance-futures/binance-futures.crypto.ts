import crypto from 'node:crypto';

function deriveKey(secret: string) {
  // 32 bytes key
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptText(plaintext: string, secret: string) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // v1:<iv>:<tag>:<cipher>
  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptText(payload: string, secret: string) {
  const parts = String(payload || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid ciphertext format');
  }
  const [, ivB64, tagB64, cipherB64] = parts;
  const key = deriveKey(secret);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
