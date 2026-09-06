/* db.js — IndexedDB do app de estudos.
   Guarda o espelho da semana (para abrir offline) e a fila de alterações
   que ainda não subiram para a planilha. Não toca no DOM: o service worker
   também carrega este arquivo. */

const DB_NOME = 'controle-estudo';
const DB_VERSAO = 2;   // 2: store 'meta' (lista de abas de semana)

function abrirDB() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Espelho das abas SEM A / SEM B, uma entrada por semana.
      if (!db.objectStoreNames.contains('semanas')) {
        db.createObjectStore('semanas', { keyPath: 'semana' });
      }
      // Alterações pendentes de envio. Chave = semana+linha, para que salvar
      // duas vezes a mesma linha não gere dois envios.
      if (!db.objectStoreNames.contains('fila')) {
        db.createObjectStore('fila', { keyPath: 'chave' });
      }
      // Lista de abas de semana, para o seletor funcionar offline.
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'chave' });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

function _tx(db, store, modo) {
  return db.transaction(store, modo).objectStore(store);
}

function _req(r) {
  return new Promise((ok, erro) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

/* ------------------------------------------------------------- semanas */

async function salvarSemana(dados) {
  const db = await abrirDB();
  return _req(_tx(db, 'semanas', 'readwrite').put(dados));
}

async function lerSemana(semana) {
  const db = await abrirDB();
  return _req(_tx(db, 'semanas', 'readonly').get(semana));
}

/* ------------------------------------------------------- lista de abas */

async function salvarSemanas(lista) {
  const db = await abrirDB();
  return _req(_tx(db, 'meta', 'readwrite').put({ chave: 'semanas', lista }));
}

async function lerSemanas() {
  const db = await abrirDB();
  const r = await _req(_tx(db, 'meta', 'readonly').get('semanas'));
  return r ? r.lista : null;
}

/* ---------------------------------------------------------------- fila */

async function enfileirar(item) {
  const db = await abrirDB();
  item.chave = item.semana + ':' + item.linha;
  item.em = Date.now();
  return _req(_tx(db, 'fila', 'readwrite').put(item));
}

async function pendentes() {
  const db = await abrirDB();
  return _req(_tx(db, 'fila', 'readonly').getAll());
}

async function desenfileirar(chave) {
  const db = await abrirDB();
  return _req(_tx(db, 'fila', 'readwrite').delete(chave));
}
