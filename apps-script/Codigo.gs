/* Codigo.gs — API da planilha de estudos.
   Cole em Extensões > Apps Script na planilha (apagando o esqueleto
   `function myFunction() {}` que vem por padrão) e publique como app da Web
   ("Executar como: eu", "Quem tem acesso: qualquer pessoa").
   O TOKEN é o que impede que quem descubra a URL escreva na sua planilha.

   Ao alterar este arquivo, republique: Implantar > Gerenciar implantações >
   lápis > Versão: Nova versão. Salvar não atualiza o que está no ar. */

const TOKEN = 'troque-esta-frase-por-uma-sua';

// Primeira linha de cada dia nas abas de semana (6 linhas por dia).
const DIAS = [
  { dia: 'Seg', linha: 4 },  { dia: 'Ter', linha: 10 },
  { dia: 'Qua', linha: 16 }, { dia: 'Qui', linha: 22 },
  { dia: 'Sex', linha: 28 }, { dia: 'Sab', linha: 34 },
  { dia: 'Dom', linha: 40 },
];
const LINHAS_POR_DIA = 6;
const PRIMEIRA = 4, ULTIMA = 45;

const COL = { objetivo: 3, planej: 4, estudado: 5, material: 6, quant: 10, acertos: 11 };

/* Aceita tanto o sufixo ("A", "3") quanto o nome inteiro ("SEM 03 · 07-13out").
   Não força maiúscula no nome todo: isso quebraria abas com data em minúscula. */
function aba_(semana) {
  const s = String(semana == null ? 'A' : semana).trim();
  const alvo = /^SEM /i.test(s) ? s : 'SEM ' + s;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ws = ss.getSheetByName(alvo);
  if (!ws) {
    ws = ss.getSheets().filter(function (x) {
      return x.getName().toUpperCase() === alvo.toUpperCase();
    })[0] || null;
  }
  if (!ws) throw new Error('aba ' + alvo + ' não encontrada');
  return ws;
}

/* Todas as abas de semana, na ordem em que estão na planilha. */
function listarSemanas_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (n) { return /^SEM /i.test(n); })
    .map(function (n) { return { nome: n, rotulo: n.replace(/^SEM\s+/i, '') }; });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function semanaJSON_(ws) {
  const bloco = ws.getRange(PRIMEIRA, 1, ULTIMA - PRIMEIRA + 1, 11).getValues();
  const dias = DIAS.map(function (d) {
    const linhas = [];
    for (var i = 0; i < LINHAS_POR_DIA; i++) {
      const linha = d.linha + i;
      const r = bloco[linha - PRIMEIRA];
      const materia = String(r[COL.objetivo - 1] || '').trim();
      if (!materia) continue;                       // slot não planejado
      linhas.push({
        linha: linha, ordem: i + 1, materia: materia,
        planej: r[COL.planej - 1] || 0,
        estudado: r[COL.estudado - 1] || '',
        material: r[COL.material - 1] || '',
        quant: r[COL.quant - 1] || '',
        acertos: r[COL.acertos - 1] || '',
      });
    }
    return { dia: d.dia, linhas: linhas };
  });
  return { semana: ws.getName().replace(/^SEM\s+/i, ''), aba: ws.getName(),
           titulo: ws.getRange('A1').getValue(), dias: dias };
}

/* Cria uma aba de semana nova a partir do Modelo, copiando a grade
   (Objetivo e Planej) de uma semana existente e deixando o progresso vazio. */
function criarSemana_(nome, base) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const alvo = /^SEM /i.test(String(nome)) ? String(nome).trim() : 'SEM ' + String(nome).trim();
  if (alvo === 'SEM ' || alvo.length < 5) throw new Error('nome vazio');
  if (ss.getSheetByName(alvo)) throw new Error('já existe uma aba ' + alvo);

  const modelo = ss.getSheetByName('Modelo');
  if (!modelo) throw new Error('aba Modelo não encontrada');

  const nova = modelo.copyTo(ss).setName(alvo);
  const n = ULTIMA - PRIMEIRA + 1;
  // grade da semana base: colunas C (Objetivo) e D (Planej)
  nova.getRange(PRIMEIRA, COL.objetivo, n, 2)
      .setValues(aba_(base || 'A').getRange(PRIMEIRA, COL.objetivo, n, 2).getValues());
  // zera o progresso herdado do Modelo
  nova.getRange(PRIMEIRA, COL.estudado, n, 2).clearContent();   // E, F
  nova.getRange(PRIMEIRA, COL.quant, n, 2).clearContent();      // J, K
  nova.getRange('A1').setValue(alvo);
  return alvo;
}

/* GET ?token=…&semana=A          -> as linhas planejadas da semana
   GET ?token=…&acao=semanas      -> a lista de abas de semana */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.token !== TOKEN) return json_({ erro: 'token inválido' });
    if (p.acao === 'semanas') return json_({ semanas: listarSemanas_() });
    return json_(semanaJSON_(aba_(p.semana)));
  } catch (err) {
    return json_({ erro: String(err && err.message ? err.message : err) });
  }
}

/* POST {token, semana, linha, estudado, material, quant, acertos}
     Campos ausentes ou null não são tocados — dá para salvar só o tempo agora
     e completar as questões depois.
   POST {token, acao:'criar', nome, base}
     Cria a aba nova e devolve a lista atualizada. */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== TOKEN) return json_({ erro: 'token inválido' });

    if (b.acao === 'criar') {
      const nome = criarSemana_(b.nome, b.base);
      return json_({ ok: true, criada: nome, semanas: listarSemanas_() });
    }

    const ws = aba_(b.semana);
    const linha = Number(b.linha);
    if (!(linha >= PRIMEIRA && linha <= ULTIMA)) return json_({ erro: 'linha fora da faixa' });

    [['estudado', COL.estudado], ['material', COL.material],
     ['quant', COL.quant], ['acertos', COL.acertos]].forEach(function (par) {
      const valor = b[par[0]];
      if (valor === undefined || valor === null) return;
      ws.getRange(linha, par[1]).setValue(valor === '' ? '' : valor);
    });

    const r = ws.getRange(linha, 1, 1, 11).getValues()[0];
    return json_({ ok: true, linha: linha, estudado: r[COL.estudado - 1] || '',
                   material: r[COL.material - 1] || '', quant: r[COL.quant - 1] || '',
                   acertos: r[COL.acertos - 1] || '' });
  } catch (err) {
    return json_({ erro: String(err && err.message ? err.message : err) });
  }
}
