/* codigo.test.js — testes do backend (apps-script/Codigo.gs) contra uma
   planilha simulada com os dados reais das abas.  Rode com:  npm test  */
const { novaPlanilha, carregarCodigo } = require('./planilha-falsa');

let falhas = 0, total = 0;
const ok = (cond, msg) => {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok    ' : '  FALHA ') + msg);
};
const secao = (t) => console.log('\n' + t);

const P = novaPlanilha();
const C = carregarCodigo(P);
const T = C.TOKEN;
const get = (p) => JSON.parse(C.doGet({ parameter: { token: T, ...p } }));
const post = (b) => JSON.parse(C.doPost({ postData: { contents: JSON.stringify({ token: T, ...b }) } }));

secao('=== doGet: semana A ===');
let a = get({ semana: 'A' });
ok(!a.erro, 'sem erro');
ok(a.dias.length === 7, '7 dias');
const mat = (r, d) => r.dias.find(x => x.dia === d).linhas.map(l => l.materia);
ok(String(mat(a, 'Seg')) === 'LEGESP,BD', 'Seg = LEGESP, BD');
ok(String(mat(a, 'Sab')) === 'LEGCOMP,SO,OAC,LEGESP', 'Sáb = LEGCOMP, SO, OAC, LEGESP');
ok(String(mat(a, 'Dom')) === 'PORT,RLM,REDES,ES', 'Dom = PORT, RLM, REDES, ES');
ok(a.dias.reduce((s, d) => s + d.linhas.length, 0) === 18, '18 slots');
ok(a.dias.find(d => d.dia === 'Seg').linhas[0].linha === 4, 'Seg 1ª hora = linha 4');
ok(a.dias.find(d => d.dia === 'Dom').linhas[3].linha === 43, 'Dom 4ª hora = linha 43');
ok(a.aba === 'SEM A' && a.semana === 'A', 'devolve aba e rótulo');

secao('=== doGet: semana B e a rotação ===');
let b = get({ semana: 'B' });
ok(String(mat(b, 'Dom')) === 'PORT,DESENV,GOVTI,SI', 'Dom da B = PORT, DESENV, GOVTI, SI');
// o esqueleto é LEGCOMP·SO·OAC·⟳ e o slot que gira vira INGLÊS na semana B
ok(String(mat(b, 'Sab')) === 'LEGCOMP,SO,OAC,INGLÊS', 'Sáb da B = LEGCOMP, SO, OAC, INGLÊS');
ok(String(mat(a, 'Sab')) === 'LEGCOMP,SO,OAC,LEGESP', 'o mesmo slot na A é LEGESP');
ok(b.dias.reduce((s, d) => s + d.linhas.length, 0) === 18, '18 slots na B');
ok(String(mat(a, 'Ter')) === String(mat(b, 'Ter')), 'terça é igual nas duas (esqueleto fixo)');

secao('=== nome da aba ===');
ok(!get({ semana: 'SEM A' }).erro, 'aceita o nome inteiro da aba');
ok(!get({ semana: 'a' }).erro, 'aceita minúscula');
ok(get({ semana: 'Z' }).erro, 'aba inexistente é recusada');

secao('=== token ===');
ok(JSON.parse(C.doGet({ parameter: { token: 'errado' } })).erro, 'GET sem token válido');
ok(JSON.parse(C.doPost({ postData: { contents: '{"token":"x","semana":"A","linha":4}' } })).erro,
   'POST sem token válido');

secao('=== acao=semanas ===');
let l = get({ acao: 'semanas' });
ok(Array.isArray(l.semanas), 'devolve lista');
ok(l.semanas.map(s => s.rotulo).join(',') === 'A,B', 'lista A e B');
ok(!l.semanas.some(s => s.nome === 'Modelo'), 'não inclui o Modelo');

secao('=== doPost grava nas colunas certas ===');
let p = post({ semana: 'A', linha: 4, estudado: 30, material: 'Estratégia — aula 4', quant: 20, acertos: 17 });
ok(p.ok, 'gravou');
const lin = () => P.abas.find(x => x.nome === 'SEM A').celulas[0];
ok(lin()[4] === 30, 'coluna E (Estudado) = 30');
ok(lin()[5] === 'Estratégia — aula 4', 'coluna F (Material) preserva acento e travessão');
ok(lin()[9] === 20 && lin()[10] === 17, 'colunas J/K = 20/17');
ok(lin()[2] === 'LEGESP' && lin()[3] === 60, 'não mexeu em Objetivo nem Planej');

secao('=== edição parcial ===');
post({ semana: 'A', linha: 4, estudado: 60 });
ok(lin()[4] === 60, 'tempo virou 60');
ok(lin()[9] === 20, 'quantidade preservada');
ok(lin()[5] === 'Estratégia — aula 4', 'material preservado');
post({ semana: 'A', linha: 4, material: '' });
ok(lin()[5] === '', 'string vazia limpa o campo de propósito');

secao('=== limites e isolamento ===');
ok(post({ semana: 'A', linha: 99 }).erro, 'linha fora da faixa');
ok(post({ semana: 'A', linha: 3 }).erro, 'linha antes da primeira');
ok(P.abas.find(x => x.nome === 'SEM B').celulas[0][4] === '', 'gravar na A não tocou na B');

secao('=== acao=criar ===');
let c = post({ acao: 'criar', nome: 'SEM 03 · 07-13out', base: 'A' });
ok(c.ok && c.criada === 'SEM 03 · 07-13out', 'criou a aba');
ok(c.semanas.map(s => s.rotulo).join(',') === 'A,B,03 · 07-13out', 'lista já traz a nova');
let n = get({ semana: 'SEM 03 · 07-13out' });
ok(!n.erro, 'a aba nova é legível');
ok(String(mat(n, 'Dom')) === 'PORT,RLM,REDES,ES', 'copiou a grade da semana A');
ok(n.dias.reduce((s, d) => s + d.linhas.length, 0) === 18, '18 slots na aba nova');
const nova = () => P.abas.find(x => x.nome === 'SEM 03 · 07-13out').celulas[0];
ok(nova()[3] === 60, 'Planej copiado');
ok(nova()[4] === '' && nova()[9] === '' && nova()[10] === '', 'progresso zerado, não herdou o da A');
ok(post({ acao: 'criar', nome: 'SEM 03 · 07-13out', base: 'A' }).erro, 'não deixa criar duplicada');
ok(post({ acao: 'criar', nome: '', base: 'A' }).erro, 'nome vazio é recusado');
ok(!post({ acao: 'criar', nome: '04', base: 'B' }).erro, 'aceita sufixo sem o prefixo SEM');
ok(P.abas.some(x => x.nome === 'SEM 04'), 'acrescentou o prefixo sozinho');

secao('=== gravar na aba nova ===');
ok(post({ semana: 'SEM 03 · 07-13out', linha: 4, estudado: 45 }).ok, 'gravou na aba nova');
ok(nova()[4] === 45, 'valor na linha certa');
ok(lin()[4] === 60, 'a semana A continua intacta');

console.log(falhas ? `\n${falhas} de ${total} FALHARAM` : `\n${total} asserções, todas passaram.`);
process.exit(falhas ? 1 : 0);
