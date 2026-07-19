import crypto from 'node:crypto';

function identitySecret() {
  const secret = process.env.LINE_USER_ID_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('LINE_IDENTITY_KEY_NOT_CONFIGURED');
  return secret;
}

export function hashLineUserId(lineUserId: string) {
  return crypto.createHmac('sha256', identitySecret()).update(lineUserId).digest('hex');
}

export function encryptLineUserId(lineUserId: string) {
  const key = crypto.createHash('sha256').update(identitySecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(lineUserId, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, encrypted, tag].map((part) => part.toString('base64url')).join('.');
}
