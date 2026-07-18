'use strict';
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

/**
 * Cifra um segredo TOTP com AES-256-GCM.
 * Retorna o valor original se TOTP_ENCRYPTION_KEY não estiver configurado.
 * Formato criptografado: "v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
function encryptTotp(plaintext) {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decifra um segredo TOTP.
 * Retorna o valor original se não estiver no formato criptografado (compatibilidade com legado).
 */
function decryptTotp(stored) {
  if (!stored || !stored.startsWith('v1:')) return stored;

  const key = getKey();
  if (!key) {
    throw new Error('TOTP_ENCRYPTION_KEY não configurado mas o segredo está criptografado.');
  }

  const parts = stored.split(':');
  if (parts.length !== 4) throw new Error('Formato de segredo TOTP inválido.');

  const [, ivHex, tagHex, encHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encryptTotp, decryptTotp };
