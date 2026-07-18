'use strict';

/**
 * Validação de variáveis de ambiente críticas no boot.
 * Se um secret estiver ausente ou fraco em produção, o processo se recusa a
 * iniciar — evita subir o site silenciosamente com configuração insegura
 * (ex.: JWT_SECRET vazio aceitaria qualquer token assinado com chave vazia).
 *
 * Defense-in-depth: a configuração atual já é forte; este guard impede
 * regressões futuras (deploy com .env incompleto ou secret de exemplo).
 */

// secret => tamanho mínimo de caracteres exigido
// Apenas vars que o PROCESSO do backend realmente recebe. A senha do Postgres
// chega embutida em DATABASE_URL (não como var solta), por isso validamos a URL.
const REQUIRED_SECRETS = {
  JWT_SECRET: 32,
  JWT_REFRESH_SECRET: 32,
  TOTP_ENCRYPTION_KEY: 64, // AES-256 = 32 bytes = 64 hex chars (tamanho exato)
  DATABASE_URL: 20,
  MP_WEBHOOK_SECRET: 16,
};

// Valores de placeholder que NUNCA devem chegar em produção
const FORBIDDEN_VALUES = new Set([
  'changeme', 'secret', 'password', 'admin', 'test', 'example',
  'your-secret-here', 'CHANGE_ME', 'troque', 'mudar',
]);

function validateEnv({ strict = process.env.NODE_ENV === 'production' } = {}) {
  const problems = [];

  for (const [name, minLen] of Object.entries(REQUIRED_SECRETS)) {
    const val = process.env[name];

    if (!val || val.trim() === '') {
      problems.push(`${name} ausente`);
      continue;
    }
    if (FORBIDDEN_VALUES.has(val.toLowerCase())) {
      problems.push(`${name} usa valor de placeholder inseguro`);
      continue;
    }
    if (val.length < minLen) {
      problems.push(`${name} muito curto (${val.length} chars, mínimo ${minLen})`);
    }
  }

  // JWT_SECRET e JWT_REFRESH_SECRET devem ser DIFERENTES — senão um refresh
  // token poderia ser usado como access token e vice-versa.
  if (
    process.env.JWT_SECRET &&
    process.env.JWT_REFRESH_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    problems.push('JWT_SECRET e JWT_REFRESH_SECRET são idênticos (devem ser distintos)');
  }

  if (problems.length === 0) return { ok: true, problems: [] };

  // Em produção, aborta o boot. Em dev, apenas avisa.
  const header = `[validateEnv] ${problems.length} problema(s) de configuração de segurança:`;
  const lines = problems.map((p) => `  ✗ ${p}`).join('\n');
  const msg = `${header}\n${lines}`;

  if (strict) {
    // eslint-disable-next-line no-console
    console.error(`\n${msg}\n\nServidor NÃO iniciado por segurança. Corrija o .env e tente novamente.\n`);
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`\n${msg}\n(modo não-produção: apenas aviso)\n`);
  }

  return { ok: false, problems };
}

module.exports = { validateEnv };
