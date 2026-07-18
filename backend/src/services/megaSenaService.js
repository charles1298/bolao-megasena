'use strict';
const logger = require('../utils/logger');

// API oficial bloqueada por Cloudflare para IPs de VPS — usa mirror público
const UNOFFICIAL_API = 'https://loteriascaixa-api.fly.dev/api/mega-sena/latest';
const UNOFFICIAL_BY_CONTEST = (n) => `https://loteriascaixa-api.fly.dev/api/mega-sena/${n}`;

// Fallback: tenta a Caixa direta com headers de browser real
const CAIXA_API_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/';
const CAIXA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx',
  Origin: 'https://loterias.caixa.gov.br',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

async function safeFetch(url, headers = {}) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchLatestResult() {
  // Tenta API mirror primeiro
  try {
    const data = await safeFetch(UNOFFICIAL_API);
    return parseUnofficial(data);
  } catch (e1) {
    logger.safeError('Mirror API falhou, tentando Caixa direta', e1);
  }

  // Fallback: Caixa direta
  try {
    const data = await safeFetch(CAIXA_API_URL, CAIXA_HEADERS);
    return parseOfficial(data);
  } catch (e2) {
    throw new Error(`Não foi possível obter resultado: ${e2.message}`);
  }
}

async function fetchResultByContest(contestNumber) {
  try {
    const data = await safeFetch(UNOFFICIAL_BY_CONTEST(contestNumber));
    return parseUnofficial(data);
  } catch (e1) {
    logger.safeError(`Mirror falhou para concurso ${contestNumber}`, e1);
  }

  try {
    const data = await safeFetch(`${CAIXA_API_URL}${contestNumber}`, CAIXA_HEADERS);
    return parseOfficial(data);
  } catch (e2) {
    throw new Error(`Concurso ${contestNumber} não encontrado: ${e2.message}`);
  }
}

function validateDrawNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== 6) {
    throw new Error(`Resultado inválido: esperado 6 números, recebido ${numbers?.length ?? 0}.`);
  }
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      throw new Error(`Número fora do intervalo permitido (1-60): ${n}`);
    }
  }
  if (new Set(numbers).size !== 6) {
    throw new Error('Resultado inválido: números duplicados detectados.');
  }
}

// Formato da API mirror (loteriascaixa-api)
function parseUnofficial(data) {
  if (!data || !data.dezenas) throw new Error('Formato inválido (mirror).');

  const [day, month, year] = (data.data || '01/01/2000').split('/');
  const drawDate = new Date(`${year}-${month}-${day}T20:00:00-03:00`);

  const numbers = data.dezenas.map((n) => parseInt(n, 10)).sort((a, b) => a - b);
  validateDrawNumbers(numbers);

  const prizes = (data.premiacoes || []).map((p) => ({
    tier: p.descricao,
    winners: p.ganhadores,
    prize: Number(p.valorPremio || 0),
  }));

  return {
    contestNumber: data.concurso,
    drawDate,
    drawDateFormatted: data.data,
    numbers,
    accumulated: !!data.acumulou,
    nextPrizeEstimate: Number(data.valorEstimadoProximoConcurso || 0),
    prizes,
  };
}

// Formato da API oficial da Caixa
function parseOfficial(data) {
  if (!data || !data.listaDezenas) throw new Error('Formato inválido (Caixa).');

  const [day, month, year] = (data.dataApuracao || '01/01/2000').split('/');
  const drawDate = new Date(`${year}-${month}-${day}T20:00:00-03:00`);

  const numbers = data.listaDezenas.map((n) => parseInt(n, 10)).sort((a, b) => a - b);
  validateDrawNumbers(numbers);

  const prizes = (data.listaRateioPremio || []).map((p) => ({
    tier: p.descricaoFaixa,
    winners: p.numeroDeGanhadores,
    prize: Number(p.valorPremio || 0),
  }));

  return {
    contestNumber: data.numero,
    drawDate,
    drawDateFormatted: data.dataApuracao,
    numbers,
    accumulated: !!data.acumulado,
    nextPrizeEstimate: Number(data.valorEstimadoProximoConcurso || 0),
    prizes,
  };
}

module.exports = { fetchLatestResult, fetchResultByContest };
