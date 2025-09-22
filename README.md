# Vendas Escolares — VENDAS

Projeto de referência com backend FastAPI + SQLite e frontend HTML/CSS/JS.

## Requisitos
- Python 3.10+
- pip
- Navegador moderno (para abrir `frontend/index.html`)

## Como rodar (Windows)
1. Crie e ative um ambiente virtual (opcional):
   - `python -m venv .venv` e ative com `.venv\\Scripts\\activate`
2. Instale dependências:
   - `pip install -r backend/requirements.txt`
3. Execute o backend:
   - `uvicorn backend.app:app --reload`
4. Acesse a API:
   - `http://localhost:8000/health`
5. Abra o frontend:
   - Abra `frontend/index.html` no navegador.

## Visual do tema (rosa & branco)

Paleta utilizada:

![Paleta](docs/palette.svg)

Exemplo de UI (mock da tela principal, com cabeçalho rosa, filtros e cards):

![Mock UI](docs/ui-mock.svg)

### Acessibilidade (resumo)
- Contraste: texto padrão em `#111827` ou `--rosa-escuro (#C2185B)` sobre branco; botões com texto branco sobre rosa primário.
- Foco: outline visível de 3px.
- Teclado: trap de foco ativo nos modais (Tab/Shift+Tab) e Escape para fechar.
- ARIA: dialogs com `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`.

## Como testar a API

Você pode importar uma das coleções de teste:

- Thunder Client (VS Code): importe `thunder-collection.json` (File > Import > Thunder Collection) e rode as requisições: GET/POST/PUT/DELETE /produtos e POST /carrinho/confirmar.
- Insomnia: importe `insomnia-collection.json` (Application > Import/Export > Import Data > From File).

Status esperados:
- 201: criação bem-sucedida em POST /produtos
- 200: atualização bem-sucedida em PUT /produtos/{id}
- 204: deleção bem-sucedida em DELETE /produtos/{id}
- 400/422: validação de payload (mensagem em `{"erro": "..."}`)
- 404: recurso não encontrado
- 500: erro interno (mensagem em `{"erro": "..."}`)

---

Copyright ©

## Como gerar o print do **Form Admin com validações**

1. Abra o backend: `uvicorn backend.app:app --reload` e acesse `http://localhost:8000` para servir estáticos.
2. Abra o `frontend/index.html` no navegador.
3. Clique em **Admin > Novo Produto** para abrir o formulário.
4. **Provoque as validações**: deixe `Nome` com menos de 3 caracteres, `Preço` vazio ou `0`, `Estoque` negativo ou vazio, e remova a `Categoria` (seletor vazio). Tente **Salvar** para que as mensagens apareçam.
5. Capture a tela (Windows: `Win+Shift+S` → modo Retângulo) e salve como `frontend/assets/prints/print-admin-validacoes.png`.
6. Inclua esse arquivo no commit final e no `REPORT.md` (seção Evidências).

> Dica: o botão **Carrinho** já possui `aria-pressed` e `aria-expanded` para acessibilidade; mantenha o foco visível na navegação por teclado para que o print mostre o estado.
