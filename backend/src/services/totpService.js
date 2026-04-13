const { authenticator } = require('otplib');
const qrcode = require('qrcode');

authenticator.options = {
  window: 1, // Aceita ±1 intervalo (30s de tolerância)
};

/**
 * Gera um novo segredo TOTP para o usuário.
 * @returns {{ secret: string, otpAuthUrl: string, qrCodeDataUrl: string }}
 */
async function generateSecret(nickname) {
  const secret = authenticator.generateSecret(32);
  const issuer = process.env.ADMIN_TOTP_ISSUER || 'BolaoMegaSena';
  const otpAuthUrl = authenticator.keyuri(nickname, issuer, secret);
  const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

  return { secret, otpAuthUrl, qrCodeDataUrl };
}

/**
 * Verifica um código TOTP contra o segredo armazenado.
 * @param {string} token - Código de 6 dígitos do autenticador
 * @param {string} secret - Segredo TOTP do usuário
 * @returns {boolean}
 */
function verifyToken(token, secret) {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

module.exports = { generateSecret, verifyToken };
