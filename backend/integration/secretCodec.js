import crypto from 'crypto';

const deriveKey = (secret) => crypto.createHash('sha256').update(String(secret)).digest();

export function createIntegrationSecretCodec(secret = process.env.ALLSENDER_BRANCHES_ENCRYPTION_KEY) {
  if (!secret) {
    return {
      available: false,
      encrypt: async () => { throw new Error('Branch integration encryption is not configured'); },
      decrypt: async () => { throw new Error('Branch integration encryption is not configured'); }
    };
  }
  const key = deriveKey(secret);
  return {
    available: true,
    encrypt: async (plainText) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
    },
    decrypt: async (encoded) => {
      const [version, ivPart, tagPart, dataPart] = String(encoded || '').split('.');
      if (version !== 'v1' || !ivPart || !tagPart || !dataPart) throw new Error('Invalid encrypted integration secret');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
    }
  };
}
