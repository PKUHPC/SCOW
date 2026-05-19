import * as crypto from "crypto";

export function generateIvAndKey() {
  const iv = crypto.randomBytes(16);
  const key = crypto.randomBytes(32);
  return {
    iv,
    key,
  };
}

export function encryptData(ivAndKey: { iv: Buffer; key: Buffer }, text: string) {
  const cipher = crypto.createCipheriv("aes-256-cbc", ivAndKey.key, ivAndKey.iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString("hex");
}

export function decryptData(ivAndKey: { iv: Buffer; key: Buffer }, text: string) {
  const encryptedTexyt = Buffer.from(text, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ivAndKey.key, ivAndKey.iv);
  let decrypted = decipher.update(encryptedTexyt);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
