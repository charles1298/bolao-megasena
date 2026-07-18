/**
 * Validação de CPF (algoritmo mod 11 oficial da Receita Federal).
 * Não consulta API externa — apenas valida o checksum interno do número.
 */

// Limpa formatação e devolve só dígitos
function cleanCpf(input) {
  return String(input || '').replace(/\D/g, '');
}

// CPFs "fáceis" que passam no mod 11 mas são reservados/inválidos
const BLACKLIST = new Set([
  '00000000000', '11111111111', '22222222222', '33333333333', '44444444444',
  '55555555555', '66666666666', '77777777777', '88888888888', '99999999999',
]);

function isValidCpf(input) {
  const cpf = cleanCpf(input);
  if (cpf.length !== 11) return false;
  if (BLACKLIST.has(cpf)) return false;

  // 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;

  // 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  if (d2 !== parseInt(cpf[10], 10)) return false;

  return true;
}

// Mascara para exibição/log: ***.***.123-45
function maskCpf(input) {
  const cpf = cleanCpf(input);
  if (cpf.length !== 11) return '***';
  return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

module.exports = { cleanCpf, isValidCpf, maskCpf };
