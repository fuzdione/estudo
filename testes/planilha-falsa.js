/* planilha-falsa.js — dublê das APIs do Apps Script.
   Monta uma planilha em memória a partir de `fixture.json`, que foi extraído
   das abas reais. Usado pelos testes e pelo servidor de desenvolvimento. */
const fs = require('fs');
const path = require('path');

const PRIMEIRA = 4, ULTIMA = 45;

function novaPlanilha() {
  const bruto = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
  const abas = [];                                    // preserva a ordem
  for (const nome of Object.keys(bruto)) {
    abas.push({ nome, celulas: bruto[nome].map(l => l.map(v => (v == null ? '' : v))) });
  }

  function faixa(aba, linha, col, nLin, nCol) {
    return {
      getValues() {
        return Array.from({ length: nLin || 1 }, (_, i) => {
          const l = aba.celulas[linha - PRIMEIRA + i] || [];
          return Array.from({ length: nCol || 1 }, (_, j) => l[col - 1 + j] ?? '');
        });
      },
      setValues(m) {
        m.forEach((linhaVals, i) => linhaVals.forEach((v, j) => {
          aba.celulas[linha - PRIMEIRA + i][col - 1 + j] = v;
        }));
      },
      clearContent() {
        for (let i = 0; i < (nLin || 1); i++)
          for (let j = 0; j < (nCol || 1); j++)
            aba.celulas[linha - PRIMEIRA + i][col - 1 + j] = '';
      },
      getValue() { return aba.celulas[linha - PRIMEIRA][col - 1]; },
      setValue(v) { aba.celulas[linha - PRIMEIRA][col - 1] = v; },
    };
  }

  function envolver(aba) {
    return {
      getName: () => aba.nome,
      setName(n) { aba.nome = n; return this; },
      getRange(a, b, c, d) {
        if (typeof a === 'string') {                   // getRange('A1')
          return { getValue: () => aba.titulo ?? ('Semana ' + aba.nome),
                   setValue: (v) => { aba.titulo = v; } };
        }
        return faixa(aba, a, b, c, d);
      },
      copyTo() {
        const copia = { nome: 'Cópia de ' + aba.nome,
                        celulas: aba.celulas.map(l => l.slice()) };
        abas.push(copia);
        return envolver(copia);
      },
      _cru: aba,
    };
  }

  const ss = {
    getSheetByName: (n) => { const a = abas.find(x => x.nome === n); return a ? envolver(a) : null; },
    getSheets: () => abas.map(envolver),
  };
  return { ss, abas, envolver };
}

/* Instala os globais que o Codigo.gs espera e carrega o script de verdade. */
function carregarCodigo(planilha) {
  global.SpreadsheetApp = { getActiveSpreadsheet: () => planilha.ss };
  global.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: (t) => ({ setMimeType: () => t }),
  };
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Codigo.gs'), 'utf8');
  const exporta = '\nmodule.exports = { doGet, doPost, TOKEN, aba_, listarSemanas_, criarSemana_ };';
  const m = { exports: {} };
  new Function('module', 'exports', src + exporta)(m, m.exports);
  return m.exports;
}

module.exports = { novaPlanilha, carregarCodigo, PRIMEIRA, ULTIMA };
