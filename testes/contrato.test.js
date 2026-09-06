/* contrato.test.js — sobe o servidor de desenvolvimento e exercita as mesmas
   requisições que o app.js monta, inclusive o Content-Type text/plain.
   Pega quebra de contrato entre front e back que o teste de unidade não vê.
   Rode com:  npm run teste:contrato  */
const { spawn } = require('child_process');
const path = require('path');

const PORTA = 8138;
const BASE = `http://localhost:${PORTA}/exec`;
const TOKEN = 'teste-local';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) falhas++; console.log((cond ? '  ok    ' : '  FALHA ') + msg); };

const get = async (p) => (await fetch(`${BASE}?${new URLSearchParams({ token: TOKEN, ...p })}`,
  { redirect: 'follow' })).json();

const post = async (b) => (await fetch(BASE, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // como o app.js faz
  body: JSON.stringify({ ...b, token: TOKEN }),
  redirect: 'follow',
})).json();

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'servidor.js')],
    { env: { ...process.env, PORTA }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) {                    // espera subir
      try { await fetch(`${BASE}?token=${TOKEN}&acao=semanas`); break; } catch { await esperar(100); }
    }

    console.log('=== lista de semanas ===');
    let l = await get({ acao: 'semanas' });
    ok(l.semanas.map(s => s.rotulo).join(',') === 'A,B', 'A e B');

    console.log('=== ciclo do app: baixar, salvar, reler ===');
    let j = await get({ semana: 'A' });
    const slot = j.dias.find(d => d.dia === 'Seg').linhas[0];
    ok(slot.materia === 'LEGESP' && slot.linha === 4, 'Seg 1ª hora = LEGESP na linha 4');
    ok(slot.estudado === '', 'ainda sem tempo');

    ok((await post({ semana: 'A', linha: 4, estudado: 30, material: 'Estratégia — aula 4',
                     quant: 20, acertos: 17 })).ok, 'gravou');

    j = await get({ semana: 'A' });
    const s2 = j.dias.find(d => d.dia === 'Seg').linhas[0];
    ok(s2.estudado === 30, 'estudado = 30');
    ok(s2.material === 'Estratégia — aula 4', 'acento e travessão intactos no round-trip');
    ok(s2.quant === 20 && s2.acertos === 17, 'questões 17/20');

    console.log('=== edição parcial ===');
    await post({ semana: 'A', linha: 4, estudado: 60 });
    const s3 = (await get({ semana: 'A' })).dias.find(d => d.dia === 'Seg').linhas[0];
    ok(s3.estudado === 60 && s3.quant === 20, 'tempo mudou, questões preservadas');

    console.log('=== criar semana pelo app ===');
    const c = await post({ acao: 'criar', nome: 'SEM 03 · 07-13out', base: 'A' });
    ok(c.ok, 'criou');
    ok(c.semanas.some(s => s.nome === 'SEM 03 · 07-13out'), 'volta na lista');
    const n = await get({ semana: '03 · 07-13out' });
    ok(!n.erro, 'legível pelo rótulo, sem o prefixo');
    ok(n.dias.find(d => d.dia === 'Seg').linhas[0].estudado === '', 'progresso zerado');
    ok((await get({ semana: 'A' })).dias.find(d => d.dia === 'Seg').linhas[0].estudado === 60,
       'a semana A continua com os 60 min');

    console.log('=== token ===');
    ok((await get({ token: 'errado' })).erro || (await (await fetch(`${BASE}?token=errado`)).json()).erro,
       'token errado é recusado');
  } finally {
    srv.kill();
  }
  console.log(falhas ? `\n${falhas} de ${total} FALHARAM` : `\n${total} asserções, todas passaram.`);
  process.exit(falhas ? 1 : 0);
})();
