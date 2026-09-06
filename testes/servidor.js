/* servidor.js — servidor de desenvolvimento.
   Serve o PWA e finge ser o app da Web do Apps Script, usando o mesmo
   Codigo.gs de produção sobre a planilha simulada. Assim dá para exercitar
   o app inteiro no navegador sem tocar na planilha de verdade.

   Uso:  npm start     ->  http://localhost:8137   (token: teste-local) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { novaPlanilha, carregarCodigo } = require('./planilha-falsa');

const RAIZ = path.join(__dirname, '..');
const PORTA = Number(process.env.PORTA || 8137);

const P = novaPlanilha();
const C = carregarCodigo(P);
const TOKEN = 'teste-local';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.png': 'image/png',
               '.webmanifest': 'application/manifest+json' };

/* O Codigo.gs valida contra a sua própria constante TOKEN; aqui aceitamos um
   token de teste e repassamos o verdadeiro para dentro. */
const comToken = (o) => ({ ...o, token: C.TOKEN });

http.createServer((req, res) => {
  const u = new URL(String(req.url).replace(/^\/+/, '/'), 'http://x');

  if (u.pathname === '/exec') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const responder = (txt) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(txt);
    };
    if (req.method === 'GET') {
      if (u.searchParams.get('token') !== TOKEN)
        return responder(JSON.stringify({ erro: 'token inválido' }));
      return responder(C.doGet({ parameter: comToken(Object.fromEntries(u.searchParams)) }));
    }
    let corpo = '';
    req.on('data', (c) => corpo += c);
    return req.on('end', () => {
      let b;
      try { b = JSON.parse(corpo); } catch { return responder(JSON.stringify({ erro: 'json inválido' })); }
      if (b.token !== TOKEN) return responder(JSON.stringify({ erro: 'token inválido' }));
      const saida = C.doPost({ postData: { contents: JSON.stringify(comToken(b)) } });
      console.log('  POST', b.acao || `linha ${b.linha}`, '->', saida.slice(0, 80));
      responder(saida);
    });
  }

  const alvo = path.join(RAIZ, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  if (!alvo.startsWith(RAIZ)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(alvo, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(alvo)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORTA, () => {
  console.log(`http://localhost:${PORTA}`);
  console.log(`Em Ajustes: URL http://localhost:${PORTA}/exec  ·  token ${TOKEN}`);
});
