# REPORT — Vendas Escolares — VENDAS (rascunho)

Este documento consolida arquitetura, decisões técnicas, validações e pontos de UX do projeto.

## Arquitetura
- Backend: FastAPI + SQLAlchemy + SQLite.
	- Endpoints: `/health`, `/produtos` (GET/POST/PUT/DELETE), `/carrinho/confirmar`.
	- Pydantic v2 (validações e serialização de Decimal).
	- CORS liberado para facilitar uso do front via `file://`.
- Banco de dados: `SQLite` (arquivo `vendas.db`).
- Frontend: HTML/CSS/JS Vanilla, consumo via fetch ao `http://localhost:8000`.

## Tecnologias e versões
- Python 3.11.x
- FastAPI 0.115.x
- Pydantic 2.x
- SQLAlchemy 2.0.x
- Uvicorn (reload para desenvolvimento)

## Peculiaridades (3)
1) Serialização de valores monetários com `Decimal` para evitar erros de ponto flutuante.
2) Paginação no front (cliente) com persistência de filtros/ordenação no `localStorage`.
3) Fluxo de carrinho no front (localStorage) com endpoint de confirmação que valida estoque, aplica cupom `ALUNO10` e persiste `Pedido`/`PedidoItem`.

## Validações principais
- Produto:
	- `nome`: 3 a 60 caracteres.
	- `preco`: >= 0.01 e duas casas decimais.
	- `estoque`: inteiro >= 0.
	- `categoria`: obrigatório.
	- `sku`: único.
- Carrinho:
	- Quantidade >= 1 por item; bloqueio quando `estoque=0` ou insuficiente.
	- Cupom `ALUNO10`: 10% de desconto sobre o subtotal.

## Paleta rosa/branco — decisões de design
- Cores base (ver também `docs/palette.svg`):
	- Rosa primário: `#ff4da6` (botões primários, header, destaques)
	- Rosa claro: `#ff80bf` (bordas, hovers)
	- Fundo suave: `#ffe6f0` (toolbars, áreas de apoio)
	- Branco: `#ffffff` (cards, superfícies)
- Contraste e acessibilidade:
	- Texto em botões sobre rosa primário em branco (`#fff`).
	- Estados desabilitados com cinza e texto `#666`.
	- Foco visível com outline compatível em CSS.
	- Ver mock: `docs/ui-mock.svg`.

### Checklist de Acessibilidade (v1.0.0)
- [x] Contraste mínimo 4.5:1 para texto normal: textos escuros (`#111827`/`--rosa-escuro #C2185B`) sobre branco.
- [x] Texto de botões em branco sobre rosa primário (áreas grandes permitem contraste adequado para elementos de UI).
- [x] Foco visível para elementos interativos (outline 3px rosa-escuro).
- [x] Navegação via teclado com trap de foco nos modais/drawers.
- [x] Atributos ARIA: `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`.

## Limitações conhecidas
- Sem autenticação/autorizações.
- Carrinho em `localStorage` (não compartilhado entre dispositivos).
- Sem paginação no backend (apenas no front).
- Sem testes automatizados extensivos (há coleções Thunder/Insomnia).

## Próximas melhorias
- Paginação/ordenação/filtragem no backend.
- Upload de imagens dos produtos.
- Autenticação básica para CRUD.
- Testes automatizados (pytest) e CI.

## Seeds e dados
- `backend/seed.py` popula ~20 produtos, incluindo alguns com `estoque=0` para cenários de bloqueio.

## Padronização de erros
- 422 e 400 retornam `{ "erro": "<mensagem>" }` para validações.
- 500 retorna `{ "erro": "Ocorreu um erro inesperado." }`.

## Prompts e justificativas (trechos aceitos/editados)

1) Prompt #1 — Scaffold (FastAPI + SQLite + front base)
	- Trecho: criação de `backend/app.py` com `GET /health` e front base com paleta rosa/branco.
	- Justificativa: ponto de partida mínimo viável para evoluir API e UI, garantindo teste rápido via `/health`.

2) Prompt #2 — Modelo Produto + GET /produtos
	- Trecho: `models.Produto` (Decimal em `Numeric(10,2)`), rota com filtros e ordenação (`nome|preco : asc|desc`).
	- Justificativa: lista de produtos é base para catálogo; uso de Decimal evita erros de arredondamento.

3) Prompt #3 — CRUD de produtos + validações
	- Trecho: Schemas Pydantic v2, POST/PUT/DELETE com status codes e mensagens claras.
	- Justificativa: gerenciamento completo do catálogo e UX confiável com retornos padronizados.

4) Prompt #6 — Carrinho + confirmar compra
	- Trecho: `POST /carrinho/confirmar`, valida estoque, aplica cupom `ALUNO10`, persiste `Pedido` e `PedidoItem`.
	- Justificativa: fluxo de compra funcional para demonstração e testes de regras.

5) Prompt #7 — UX (filtros, ordenação persistida, paginação)
	- Trecho: `localStorage` para persistir preferências e paginação cliente (10 itens/página).
	- Justificativa: melhora de usabilidade sem complexidade no backend neste estágio.

6) Prompt #8 — Padronização de erros + coleções de API
	- Trecho: handlers para 422/400/500 retornando `{erro: "..."}`; inclusão de `thunder-collection.json` e `insomnia-collection.json`.
	- Justificativa: teste e diagnóstico consistentes, além de documentação executável da API.

7) Prompt #9 — Seed (~20) + mídia + docs
	- Trecho: `backend/seed.py` com ~20 itens (inclui estoque=0); `docs/palette.svg` e `docs/ui-mock.svg`; README/REPORT.
	- Justificativa: dados plausíveis para UX e validação de regras de bloqueio; documentação visual do tema.

8) Prompt #10 — Acessibilidade e release v1.0.0
	- Trecho: ARIA nos modais, focus trap, foco visível, tipografia reforçada; tag `v1.0.0` publicada.
	- Justificativa: conformidade básica com acessibilidade de teclado e fechamento do ciclo de release.


## Diagrama (fluxo requisição → resposta)

```text
[Front (HTML/CSS/JS)]
   |  fetch (GET/POST/PUT/DELETE)
   v
[FastAPI app.py] --(SQLAlchemy ORM)--> [SQLite (vendas.db)]
   |  POST /carrinho/confirmar (valida estoque, aplica cupom)
   v
[Pedido + Itens]  <-- persiste total_final/subtotal/desconto
```


## Peculiaridades implementadas (3/10+)
- Seed script com ~20 produtos (backend/seed.py).
- Ordenação persistida (localStorage) por nome/preço (select#sort).
- Export da lista atual (CSV/JSON) via botões (front).
- Tratamento de erros (toasts visuais + HTTP codes padronizados).
- Acessibilidade: aria-label em botões, foco visível, navegação por teclado.

## Como rodar (resumo)
1. Criar venv e instalar dependências:
   ```bash
   python -m venv .venv && .venv/Scripts/activate  # Windows
   pip install -r backend/requirements.txt
   ```
2. Criar DB e dados de exemplo:
   ```bash
   python -m backend.seed
   ```
3. Subir API:
   ```bash
   uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
   ```
4. Abrir `frontend/index.html` no navegador (duplo clique).

## Testes de API
- Coleções incluídas na raiz: `thunder-collection.json` e `insomnia-collection.json` com rotas
  - GET/POST/PUT/DELETE /produtos
  - POST /carrinho/confirmar (mock de pedido com baixa de estoque e `cupom: ALUNO10`)
