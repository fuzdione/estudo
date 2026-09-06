/* app.js — telas e sincronização com a planilha.
   Regra de ouro: salvar sempre local primeiro e só depois tentar a rede.
   Assim nunca se perde um registro por estar sem sinal. */

const DIAS_ORDEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const cfg = {
  get url()   { return localStorage.getItem('url') || ''; },
  get token() { return localStorage.getItem('token') || ''; },
  get semana(){ return localStorage.getItem('semana') || 'A'; },
  set semana(v){ localStorage.setItem('semana', v); },
};

let estado = { semana: 'A', dia: DIAS_ORDEM[new Date().getDay()], dados: null, editando: null };

const $ = (id) => document.getElementById(id);
const mostrar = (tela) => document.querySelectorAll('.tela')
  .forEach(t => t.classList.toggle('oculto', t.id !== tela));

function toast(msg, erro) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('erro', !!erro);
  t.classList.remove('oculto');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('oculto'), 2600);
}

/* ------------------------------------------------------------- rede */

async function baixarSemana(semana) {
  if (!cfg.url || !cfg.token) throw new Error('sem configuração');
  const u = `${cfg.url}?token=${encodeURIComponent(cfg.token)}&semana=${semana}`;
  const r = await fetch(u, { redirect: 'follow' });
  const j = await r.json();
  if (j.erro) throw new Error(j.erro);
  return j;
}

async function enviar(item) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    // text/plain evita o preflight de CORS, que o Apps Script não responde
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...item, token: cfg.token }),
    redirect: 'follow',
  });
  const j = await r.json();
  if (j.erro) throw new Error(j.erro);
  return j;
}

/* Sobe tudo que está na fila. Silencioso: se falhar, fica para a próxima. */
async function sincronizar() {
  if (!cfg.url || !cfg.token || !navigator.onLine) return 0;
  const fila = await pendentes();
  let n = 0;
  for (const item of fila) {
    try {
      const { chave, em, ...campos } = item;
      await enviar(campos);
      await desenfileirar(chave);
      n++;
    } catch (e) { break; }        // rede instável: tenta de novo depois
  }
  if (n) toast(`${n} registro${n > 1 ? 's' : ''} sincronizado${n > 1 ? 's' : ''}`);
  return n;
}

/* ------------------------------------------------------------ dados */

async function carregar(forcarRede) {
  estado.semana = cfg.semana;
  const local = await lerSemana(estado.semana);
  if (local) { estado.dados = local; render(); }

  if (forcarRede !== false) {
    try {
      await sincronizar();
      const novo = await baixarSemana(estado.semana);
      novo.semana = estado.semana;
      await salvarSemana(novo);
      estado.dados = novo;
      render();
      $('aviso').classList.add('oculto');
    } catch (e) {
      if (!local) {
        $('aviso').textContent = cfg.url
          ? 'Não consegui falar com a planilha. Abra Ajustes e confira a URL e o token.'
          : 'Configure a URL do app da Web em Ajustes para sincronizar.';
        $('aviso').classList.remove('oculto');
      }
    }
  }
}

const linhasDoDia = () => {
  const d = (estado.dados?.dias || []).find(x => x.dia === estado.dia);
  return d ? d.linhas : [];
};

/* ------------------------------------------------------------ telas */

function render() {
  $('semana-atual').textContent = estado.semana;
  $('dia-nome').textContent = estado.dia;
  $('btn-semana').textContent = 'Trocar p/ ' + (estado.semana === 'A' ? 'B' : 'A');

  const linhas = linhasDoDia();
  const feito = linhas.reduce((s, l) => s + (Number(l.estudado) || 0), 0);
  const meta = linhas.reduce((s, l) => s + (Number(l.planej) || 0), 0);
  $('topo-progresso').textContent = `${feito} de ${meta} min`;

  const q = linhas.reduce((s, l) => s + (Number(l.quant) || 0), 0);
  const a = linhas.reduce((s, l) => s + (Number(l.acertos) || 0), 0);
  $('topo-sub').textContent = q
    ? `${q} questões · ${a} acertos · ${Math.round(100 * a / q)}%`
    : (linhas.length ? 'nenhuma questão registrada hoje' : 'nada planejado neste dia');

  $('lista').innerHTML = '';
  linhas.forEach(l => {
    const done = Number(l.estudado) > 0;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card' + (done ? ' feito' : '');
    card.innerHTML = `
      <div class="card-topo">
        <span class="card-materia">${l.materia}</span>
        <span class="card-hora">${l.ordem}ª hora</span>
      </div>
      <div class="card-linha">
        <span class="${done ? 'ok' : 'pend'}">${done ? l.estudado + ' min' : 'não registrado'}</span>
        ${Number(l.quant) ? `<span class="sep">·</span><span>${l.acertos || 0}/${l.quant} questões</span>` : ''}
      </div>
      ${l.material ? `<div class="card-material">${l.material}</div>` : ''}`;
    card.onclick = () => abrirForm(l);
    $('lista').appendChild(card);
  });
}

function abrirForm(l) {
  estado.editando = l;
  $('form-titulo').textContent = `${l.materia} · ${l.ordem}ª hora`;
  $('f-estudado').value = l.estudado || '';
  $('f-material').value = l.material || '';
  $('f-quant').value = l.quant || '';
  $('f-acertos').value = l.acertos || '';
  aproveitamento();
  mostrar('tela-form');
}

function aproveitamento() {
  const q = Number($('f-quant').value), a = Number($('f-acertos').value);
  $('aproveitamento').textContent = q > 0
    ? `${Math.round(100 * a / q)}% de aproveitamento` : '—';
}

async function salvar() {
  const l = estado.editando;
  const item = {
    semana: estado.semana,
    linha: l.linha,
    estudado: $('f-estudado').value === '' ? '' : Number($('f-estudado').value),
    material: $('f-material').value.trim(),
    quant: $('f-quant').value === '' ? '' : Number($('f-quant').value),
    acertos: $('f-acertos').value === '' ? '' : Number($('f-acertos').value),
  };

  Object.assign(l, item);                 // reflete na tela na hora
  await salvarSemana(estado.dados);
  await enfileirar(item);
  render();
  mostrar('tela-dia');

  try {
    const n = await sincronizar();
    if (!n) toast('Salvo no aparelho. Sobe quando houver rede.');
  } catch (e) {
    toast('Salvo no aparelho. Sobe quando houver rede.');
  }
}

/* ------------------------------------------------------------ eventos */

$('btn-semana').onclick = () => {
  cfg.semana = estado.semana === 'A' ? 'B' : 'A';
  carregar();
};

$('btn-outro-dia').onclick = () => {
  const i = DIAS_ORDEM.indexOf(estado.dia);
  estado.dia = DIAS_ORDEM[(i + 1) % 7];
  render();
};

$('btn-cancelar').onclick = () => mostrar('tela-dia');
$('btn-salvar').onclick = salvar;
$('f-quant').oninput = aproveitamento;
$('f-acertos').oninput = aproveitamento;

document.querySelectorAll('#chips-tempo .chip').forEach(c => {
  c.onclick = () => { $('f-estudado').value = c.dataset.min; };
});

$('btn-config').onclick = () => {
  $('c-url').value = cfg.url;
  $('c-token').value = cfg.token;
  mostrar('tela-config');
};
$('btn-config-voltar').onclick = () => mostrar('tela-dia');
$('btn-config-salvar').onclick = () => {
  localStorage.setItem('url', $('c-url').value.trim());
  localStorage.setItem('token', $('c-token').value.trim());
  mostrar('tela-dia');
  carregar();
};

window.addEventListener('online', () => carregar());

/* ------------------------------------------------------------ início */

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
carregar();
