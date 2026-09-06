/* Codigo.gs — API da planilha de estudos.
   Cole em Extensões > Apps Script na planilha e publique como app da Web
   ("Executar como: eu", "Quem tem acesso: qualquer pessoa com o link").
   O TOKEN é o que impede que quem descubra a URL escreva na sua planilha. */

const TOKEN = 'troque-esta-frase-por-uma-sua';

// Primeira linha de cada dia nas abas SEM A / SEM B (6 linhas por dia).
const DIAS = [
  { dia: 'Seg', linha: 4 },  { dia: 'Ter', linha: 10 },
  { dia: 'Qua', linha: 16 }, { dia: 'Qui', linha: 22 },
  { dia: 'Sex', linha: 28 }, { dia: 'Sab', linha: 34 },
  { dia: 'Dom', linha: 40 },
];
const LINHAS_POR_DIA = 6;

const COL = { objetivo: 3, planej: 4, estudado: 5, material: 6, quant: 10, acertos: 11 };

function aba_(semana) {
  const nome = 'SEM ' + String(semana || 'A').toUpperCase();
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!ws) throw new Error('aba ' + nome + ' não encontrada');
  return ws;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* GET ?token=...&semana=A  ->  as linhas planejadas da semana */
function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.token !== TOKEN) return json_({ erro: 'token inválido' });

    const ws = aba_(p.semana);
    const bloco = ws.getRange(4, 1, 42, 11).getValues();   // linhas 4..45
    const dias = DIAS.map(function (d) {
      const linhas = [];
      for (var i = 0; i < LINHAS_POR_DIA; i++) {
        const linha = d.linha + i;
        const r = bloco[linha - 4];
        const materia = String(r[COL.objetivo - 1] || '').trim();
        if (!materia) continue;                             // slot não planejado
        linhas.push({
          linha: linha,
          ordem: i + 1,
          materia: materia,
          planej: r[COL.planej - 1] || 0,
          estudado: r[COL.estudado - 1] || '',
          material: r[COL.material - 1] || '',
          quant: r[COL.quant - 1] || '',
          acertos: r[COL.acertos - 1] || '',
        });
      }
      return { dia: d.dia, linhas: linhas };
    });
    return json_({ semana: String(p.semana || 'A').toUpperCase(),
                   titulo: ws.getRange('A1').getValue(), dias: dias });
  } catch (err) {
    return json_({ erro: String(err) });
  }
}

/* POST {token, semana, linha, estudado, material, quant, acertos}
   Campos ausentes ou null não são tocados — dá para salvar só o tempo agora
   e completar as questões depois. */
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== TOKEN) return json_({ erro: 'token inválido' });

    const ws = aba_(b.semana);
    const linha = Number(b.linha);
    if (!(linha >= 4 && linha <= 45)) return json_({ erro: 'linha fora da faixa' });

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
    return json_({ erro: String(err) });
  }
}
