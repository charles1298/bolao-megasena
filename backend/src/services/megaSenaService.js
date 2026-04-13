'use strict';
const logger = require('../utils/logger');

const CAIXA_API_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/';

/**
 * Busca o último resultado oficial da Mega Sena na API pública da Caixa Econômica Federal.
 * Usa fetch nativo (Node >= 20).
 * @returns {{ contestNumber, drawDate, drawDateFormatted, numbers, accumulated, nextPrizeEstimate, prizes }}
 */
async function fetchLatestResult() {
  let res;
  try {
    res = await fetch(CAIXA_API_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; BolaoMegaSena/1.0)',
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new Error(`Falha ao conectar na API da Caixa: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`API da Caixa retornou status ${res.status}`);
  }

  const data = await res.json();
  return parseResult(data);
}

/**
 * Busca resultado de um concurso específico pelo número.
 * @param {number} contestNumber
 */
async function fetchResultByContest(contestNumber) {
  let res;
  try {
    res = await fetch(`${CAIXA_API_URL}${contestNumber}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; BolaoMegaSena/1.0)',
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new Error(`Falha ao conectar na API da Caixa: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Concurso ${contestNumber} não encontrado (status ${res.status}).`);
  }

  const data = await res.json();
  return parseResult(data);
}

/**
 * Transforma o JSON da Caixa no formato interno.
 */
function parseResult(data) {
  if (!data || !data.listaDezenas) {
    throw new Error('Formato de resposta da API da Caixa inválido.');
  }

  // "dd/MM/yyyy" → Date no fuso de Brasília (UTC-3)
  const [day, month, year] = (data.dataApuracao || '01/01/2000').split('/');
  const drawDate = new Date(`${year}-${month}-${day}T20:00:00-03:00`);

  const numbers = data.listaDezenas
    .map((n) => parseInt(n, 10))
    .sort((a, b) => a - b);

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
