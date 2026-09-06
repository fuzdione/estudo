# Estudo COFEN — PWA

Registra tempo estudado, material e questões direto na planilha do Drive,
sem precisar abrir o Sheets e caçar a linha certa.

```
PWA (celular) ──fetch──> Apps Script Web App ──> planilha no Drive
     │
  IndexedDB — fila offline, sobe sozinha quando volta a rede
```

A planilha continua sendo a fonte da verdade: o que você editar direto no
Sheets aparece no app na próxima abertura.

## 1. Publicar o Apps Script

1. Abra a planilha → **Extensões → Apps Script**
2. Cole o conteúdo de `apps-script/Codigo.gs`
3. Troque a constante `TOKEN` por uma frase sua (é o que impede que alguém
   com a URL escreva na sua planilha)
4. **Implantar → Nova implantação → Tipo: App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa com o link**
5. Copie a URL que termina em `/exec`

O aviso de "app não verificado" na primeira autorização é esperado — o script
é seu e roda na sua conta.

## 2. Publicar o app

Precisa de HTTPS para o service worker funcionar. Qualquer hospedagem estática
serve; GitHub Pages ou Netlify resolvem em minutos. Para testar no PC:

```bash
python -m http.server 8080    # depois abra http://localhost:8080
```

Faltam os ícones em `icons/icon-192.png` e `icons/icon-512.png` — sem eles o
app funciona, mas não instala bonito na tela inicial.

## 3. Configurar no celular

Abra o app → **Ajustes** → cole a URL do `/exec` e o token → Salvar.
Depois use **Compartilhar → Adicionar à tela de início**.

## Como usar

A tela abre no dia de hoje mostrando os slots planejados da semana corrente.
Toque num deles, informe o tempo (há atalhos de 15/30/45/60 min), o material
se quiser, e a quantidade de questões e acertos. Salvar grava no aparelho na
hora e sincroniza quando houver rede.

**Trocar p/ B** alterna a semana do ciclo rotativo; **Outro dia** percorre os
dias, para lançar algo esquecido.

## Detalhes que importam

- Salvar sempre grava local primeiro. Sem sinal, o registro entra na fila e
  sobe depois — nada se perde.
- A fila tem chave `semana:linha`, então salvar a mesma linha duas vezes
  substitui o pendente em vez de duplicar.
- Campo em branco não apaga o que está na planilha; só é gravado o que você
  preencheu.
- O POST usa `Content-Type: text/plain` de propósito: evita o preflight de
  CORS, que o Apps Script não responde.
- As colunas gravadas são `Estudado` (E), `Material` (F), `Quant` (J) e
  `Acertos` (K). O `% Acertos` é fórmula da planilha e se atualiza sozinho.
- Se você mudar o layout das abas `SEM A`/`SEM B`, ajuste `DIAS` e `COL` no
  `Codigo.gs`.
