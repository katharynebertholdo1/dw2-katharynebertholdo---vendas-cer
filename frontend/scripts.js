document.addEventListener('DOMContentLoaded', () => {
  const btnCart = document.getElementById('btn-cart');
  const drawer = document.getElementById('cart-drawer');
  const btnClose = document.getElementById('btn-close-cart');
  const grid = document.getElementById('products-grid');
  const statusBox = document.getElementById('catalog-status');
  const btnNew = document.getElementById('btn-new');
  const inputText = document.getElementById('filter-text');
  const selectCat = document.getElementById('filter-category');
  const selectSort = document.getElementById('sort');
  const pager = document.getElementById('pagination');

  // Helper: normaliza acentos/maiúsculas p/ chave de lookup
  function key(s){
    try { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
    catch(e){ return String(s).toLowerCase().trim(); }
  }

  // Mapeamento de imagens (catálogo + carrinho) — chaves normalizadas
  const IMAGENS = {
    "lapis hb": "assets/img/lapis-hb.jpg",
    "caneta azul": "assets/img/Caneta azul.jpg",
    "caneta preta": "assets/img/Caneta preta.jpg",
    "caneta vermelha": "assets/img/Caneta vermelha.jpg",
    "borracha": "assets/img/Borracha.jpg",
    "apontador": "assets/img/Apontador.jpg",
    "regua 30cm": "assets/img/regua-30cm.jpg",
    "caderno universitario": "assets/img/caderno-universitario.jpg",
  };

  // Modal de produto
  const modal = document.getElementById('product-modal');
  const btnCloseProduct = document.getElementById('btn-close-product');
  const form = document.getElementById('product-form');
  const title = document.getElementById('product-title');
  const toast = document.getElementById('toast');

  const field = (id) => document.getElementById(id);
  const fid = {
    id: field('prod-id'),
    nome: field('prod-nome'),
    descricao: field('prod-descricao'),
    preco: field('prod-preco'),
    estoque: field('prod-estoque'),
    categoria: field('prod-categoria'),
    sku: field('prod-sku'),
  };

  const ferr = {
    nome: field('err-nome'),
    descricao: field('err-descricao'),
    preco: field('err-preco'),
    estoque: field('err-estoque'),
    categoria: field('err-categoria'),
    sku: field('err-sku'),
  };

  // Acessibilidade: foco/teclado no drawer
  const focusableSelector = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
  let lastFocus = null;
  function trapFocus(container, e){
    const f = Array.from(container.querySelectorAll(focusableSelector)).filter(el=>!el.hasAttribute('disabled'));
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length-1];
    if (e.key === 'Tab'){
      if (e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
    }
  }

  const openDrawer = () => {
    lastFocus = document.activeElement;
    drawer.classList.remove('hidden');
    btnCart.setAttribute('aria-expanded', 'true');
    btnClose.focus();
    drawer.addEventListener('keydown', onDrawerKeydown);
  };
  const closeDrawer = () => {
    drawer.classList.add('hidden');
    btnCart.setAttribute('aria-expanded', 'false');
    drawer.removeEventListener('keydown', onDrawerKeydown);
    if (lastFocus) lastFocus.focus(); else btnCart.focus();
  };
  function onDrawerKeydown(e){ trapFocus(drawer, e); if (e.key === 'Escape') closeDrawer(); }
  btnCart.addEventListener('click', openDrawer);
  btnClose.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.classList.contains('hidden')) closeDrawer(); });

  // Renderizar produto (catálogo)
  function productCard(p) {
    const el = document.createElement('div');
    el.className = 'product-card';

    // Thumb com imagem
    const thumb = document.createElement('div');
    thumb.className = 'product-thumb';
    const imgSrc = IMAGENS[key(p.nome)];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = `Imagem de ${p.nome}`;
      img.loading = 'lazy';
      thumb.appendChild(img);
    }
    el.appendChild(thumb);

    // Demais infos
    el.insertAdjacentHTML('beforeend', `
      <h3>${p.nome}</h3>
      <p class="price">R$ ${Number(p.preco).toFixed(2)}</p>
      <button class="btn btn-primary" aria-label="Adicionar ${p.nome} ao carrinho">Adicionar</button>
    `);
    return el;
  }

  // Estado de UX + filtros
  const UX_KEY = 'vendas_ux_v1';
  const ux = { sort: 'nome:asc', text: '', categoria: '', page: 1 };
  function saveUX(){ localStorage.setItem(UX_KEY, JSON.stringify(ux)); }
  function loadUX(){ try{ Object.assign(ux, JSON.parse(localStorage.getItem(UX_KEY)||'{}')); }catch{} }
  loadUX();
  if (selectSort) selectSort.value = ux.sort || 'nome:asc';
  if (inputText) inputText.value = ux.text || '';
  if (selectCat) selectCat.value = ux.categoria || '';

  function applySkeleton() {
    grid.innerHTML = '';
    for (let i=0;i<6;i++) {
      const sk = document.createElement('div');
      sk.className = 'product-card skeleton';
      sk.style.height = '180px';
      grid.appendChild(sk);
    }
  }

  async function loadProducts() {
    grid.setAttribute('aria-busy', 'true');
    statusBox.textContent = 'Carregando produtos...';
    applySkeleton();
    try {
      const params = new URLSearchParams();
      if (ux.text) params.set('search', ux.text);
      if (ux.categoria) params.set('categoria', ux.categoria);
      if (ux.sort) params.set('sort', ux.sort);

      const resp = await fetch(`http://localhost:8000/produtos?${params.toString()}`);
      if (!resp.ok) throw new Error('Falha ao carregar produtos');
      const data = await resp.json();

      // Popular categorias
      const categorias = [...new Set(data.map(p => p.categoria))].sort();
      selectCat.innerHTML = '<option value="">Todas categorias</option>' + categorias.map(c=>`<option value="${c}">${c}</option>`).join('');
      if (ux.categoria) selectCat.value = ux.categoria;

      // Paginação (aqui usando a lista toda na página)
      const pageSize = data.length;
      const total = data.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      if (ux.page > totalPages) ux.page = 1;
      const start = (ux.page - 1) * pageSize;
      const pageItems = data.slice(start, start + pageSize);

      grid.innerHTML = '';
      if (!Array.isArray(data) || data.length === 0) {
        statusBox.textContent = 'Nenhum produto disponível.';
      } else {
        pageItems.forEach(p => grid.appendChild(productCard(p)));
        statusBox.textContent = `${total} produto(s) • página ${ux.page}/${totalPages}`;
      }

      // Oculta pager por ora
      pager.innerHTML = '';
      if (pager) pager.style.display = 'none';
    } catch (err) {
      console.error(err);
      statusBox.textContent = 'Erro ao carregar produtos. Verifique se o backend está em execução.';
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }
  }

  loadProducts();

  // Carrinho (localStorage)
  const CART_KEY = 'vendas_cart_v1';
  const cart = { items: {} }; // produtoId -> { produto, qtd }
  function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateBadge(); }
  function loadCart() { try { const v = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); if (v && v.items) Object.assign(cart, v); } catch {} updateBadge(); }
  function countItems() { return Object.values(cart.items).reduce((acc, it) => acc + it.qtd, 0); }
  function subtotal() { return Object.values(cart.items).reduce((acc, it) => acc + (Number(it.produto.preco) * it.qtd), 0); }

  // Badge
  const btnCartBadge = document.getElementById('btn-cart');
  function updateBadge() { btnCartBadge.dataset.count = String(countItems()); }
  loadCart();

  // UI do carrinho dentro do drawer
  const cartItemsEl = document.getElementById('cart-items');
  const cartFooter = document.querySelector('.drawer-footer');
  const confirmBtn = cartFooter.querySelector('button.btn-primary');

  // Cupom e Subtotal
  const couponWrap = document.createElement('div');
  couponWrap.className = 'form-row';
  couponWrap.innerHTML = `
    <div class="form-field"><label for="cupom">Cupom</label><input id="cupom" type="text" placeholder="ALUNO10" /></div>
    <div class="form-field"><label>Subtotal</label><input id="subtotal" type="text" disabled /></div>
  `;
  cartFooter.prepend(couponWrap);
  const couponInput = couponWrap.querySelector('#cupom');
  const subtotalInput = couponWrap.querySelector('#subtotal');

  function renderCart() {
    cartItemsEl.innerHTML = '';
    const entries = Object.values(cart.items);
    if (entries.length === 0) {
      cartItemsEl.textContent = 'Seu carrinho está vazio.';
      subtotalInput.value = 'R$ 0,00';
      confirmBtn.disabled = true;
      return;
    }
    confirmBtn.disabled = false;
    entries.forEach(({ produto, qtd }) => {
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;width:100%">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div class="cart-thumb"></div>
            <div>
              <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${produto.nome}</div>
              <div style="color:#6b7280">R$ ${Number(produto.preco).toFixed(2)}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn-ic" aria-label="Diminuir quantidade">-</button>
            <span aria-live="polite" style="min-width:20px;text-align:center">${qtd}</span>
            <button class="btn-ic" aria-label="Aumentar quantidade">+</button>
            <button class="btn-ic" aria-label="Remover item">x</button>
          </div>
        </div>
      `;

      // Miniatura no carrinho
      const thumbSrc = IMAGENS[key(produto.nome)];
      if (thumbSrc) {
        const img = document.createElement('img');
        img.src = thumbSrc;
        img.alt = `Imagem de ${produto.nome}`;
        const holder = row.querySelector('.cart-thumb');
        if (holder) holder.appendChild(img);
      }

      const [btnMinus, btnPlus, btnRemove] = row.querySelectorAll('button.btn-ic');
      btnMinus.addEventListener('click', () => { if (cart.items[produto.id].qtd > 1) { cart.items[produto.id].qtd--; saveCart(); renderCart(); } });
      btnPlus.addEventListener('click', () => { cart.items[produto.id].qtd++; saveCart(); renderCart(); });
      btnRemove.addEventListener('click', () => { delete cart.items[produto.id]; saveCart(); renderCart(); });

      cartItemsEl.appendChild(row);
    });
    subtotalInput.value = `R$ ${subtotal().toFixed(2)}`;
  }

  // Hook nos botões "Adicionar" dos cards
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.btn.btn-primary');
    if (!btn) return;
    const card = btn.closest('.product-card');
    if (!card) return;
    const nameEl = card.querySelector('h3');
    const priceEl = card.querySelector('.price');
    const name = nameEl ? nameEl.textContent : 'Produto';
    const price = priceEl ? Number(priceEl.textContent.replace(/[^0-9.,]/g,'').replace(',','.')) : 0;

    // Busca produto pelo nome/preço atuais
    fetch('http://localhost:8000/produtos').then(r=>r.json()).then(list => {
      const prod = list.find(p => p.nome === name && Number(p.preco).toFixed(2) === price.toFixed(2));
      if (!prod) { showToast('Produto não encontrado.'); return; }
      if (!cart.items[prod.id]) cart.items[prod.id] = { produto: prod, qtd: 0 };
      cart.items[prod.id].qtd++;
      saveCart();
      renderCart();
      showToast('Adicionado ao carrinho.');
    });
  });

  // Confirmar compra
  confirmBtn.addEventListener('click', async () => {
    const entries = Object.values(cart.items);
    if (entries.length === 0) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirmando...';
    try {
      const payload = {
        itens: entries.map(({ produto, qtd }) => ({ produto_id: produto.id, quantidade: qtd })),
        cupom: couponInput.value.trim() || null,
      };
      const resp = await fetch('http://localhost:8000/carrinho/confirmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!resp.ok) throw await resp.json();
      const pedido = await resp.json();
      showToast(`Pedido #${pedido.id} confirmado. Total R$ ${Number(pedido.total).toFixed(2)}`);
      cart.items = {}; saveCart(); renderCart(); await loadProducts();
    } catch (err) {
      console.error(err);
      const msg = (err && err.detail && (err.detail.erro || err.detail)) || 'Erro ao confirmar.';
      showToast(typeof msg === 'string' ? msg : 'Erro ao confirmar.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Finalizar';
    }
  });

  // Re-render quando abrir o carrinho
  btnCart.addEventListener('click', renderCart);

  // Util: toast
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // Formulário: abrir/fechar
  function openForm(mode, data) {
    lastFocus = document.activeElement;
    modal.classList.remove('hidden');
    title.textContent = mode === 'edit' ? 'Editar Produto' : 'Novo Produto';
    if (mode === 'edit' && data) {
      fid.id.value = data.id;
      fid.nome.value = data.nome || '';
      fid.descricao.value = data.descricao || '';
      fid.preco.value = Number(data.preco).toFixed(2);
      fid.estoque.value = data.estoque ?? 0;
      fid.categoria.value = data.categoria || '';
      fid.sku.value = data.sku || '';
    } else {
      form.reset();
      fid.id.value = '';
    }
    fid.nome.focus();
    modal.addEventListener('keydown', onModalKeydown);
  }
  function closeForm() { modal.classList.add('hidden'); modal.removeEventListener('keydown', onModalKeydown); if (lastFocus) lastFocus.focus(); }
  function onModalKeydown(e){ trapFocus(modal, e); if (e.key === 'Escape') closeForm(); }
  btnNew.addEventListener('click', () => openForm('new'));
  btnCloseProduct.addEventListener('click', closeForm);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeForm(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeForm(); });

  // Validações do formulário
  function validate() {
    let ok = true;
    Object.values(ferr).forEach(el => el.textContent = '');
    const nome = fid.nome.value.trim();
    if (nome.length < 3 || nome.length > 60) { ferr.nome.textContent = 'Nome deve ter 3 a 60 caracteres.'; ok = false; }
    const preco = parseFloat(fid.preco.value);
    if (isNaN(preco) || preco < 0.01) { ferr.preco.textContent = 'Preço deve ser >= 0,01.'; ok = false; }
    fid.preco.value = isNaN(preco) ? '' : preco.toFixed(2);
    const estoque = parseInt(fid.estoque.value, 10);
    if (isNaN(estoque) || estoque < 0) { ferr.estoque.textContent = 'Estoque deve ser >= 0.'; ok = false; }
    const categoria = fid.categoria.value.trim();
    if (!categoria) { ferr.categoria.textContent = 'Categoria é obrigatória.'; ok = false; }
    const sku = fid.sku.value.trim();
    if (sku.length > 64) { ferr.sku.textContent = 'SKU deve ter no máximo 64 caracteres.'; ok = false; }
    return ok;
  }

  // CRUD helpers
  async function apiCreate(body) {
    const resp = await fetch('http://localhost:8000/produtos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw await resp.json();
    return resp.json();
  }
  async function apiUpdate(id, body) {
    const resp = await fetch(`http://localhost:8000/produtos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw await resp.json();
    return resp.json();
  }
  async function apiDelete(id) {
    const resp = await fetch(`http://localhost:8000/produtos/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw await resp.json();
  }

  // Envio do formulário
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const body = {
      nome: fid.nome.value.trim(),
      descricao: fid.descricao.value.trim() || null,
      preco: parseFloat(fid.preco.value),
      estoque: parseInt(fid.estoque.value, 10),
      categoria: fid.categoria.value.trim(),
      sku: fid.sku.value.trim() || null,
    };
    try {
      const id = fid.id.value;
      if (id) {
        await apiUpdate(id, body);
        showToast('Produto atualizado.');
      } else {
        await apiCreate(body);
        showToast('Produto criado.');
      }
      closeForm();
      await loadProducts();
    } catch (err) {
      console.error(err);
      const msg = (err && err.detail && (err.detail.erro || err.detail)) || 'Erro ao salvar produto.';
      showToast(typeof msg === 'string' ? msg : 'Erro ao salvar produto.');
    }
  });

  field('btn-cancel').addEventListener('click', (e) => { e.preventDefault(); closeForm(); });

  // Ações nos cards (editar/excluir)
  function productActions(p) {
    const wrap = document.createElement('div');
    wrap.className = 'product-actions';
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-icon';
    btnEdit.title = 'Editar';
    btnEdit.textContent = '✏️';
    btnEdit.addEventListener('click', () => openForm('edit', p));

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon';
    btnDel.title = 'Excluir';
    btnDel.textContent = '🗑️';
    btnDel.addEventListener('click', async () => {
      if (!confirm(`Excluir ${p.nome}?`)) return;
      try {
        await apiDelete(p.id);
        showToast('Produto excluído.');
        await loadProducts();
      } catch (err) {
        console.error(err);
        showToast('Erro ao excluir.');
      }
    });

    wrap.append(btnEdit, btnDel);
    return wrap;
  }

  // Filtros e ordenação (persistidos)
  inputText.addEventListener('input', () => { ux.text = inputText.value.trim(); ux.page = 1; saveUX(); loadProducts(); });
  selectCat.addEventListener('change', () => { ux.categoria = selectCat.value; ux.page = 1; saveUX(); loadProducts(); });
  selectSort.addEventListener('change', () => { ux.sort = selectSort.value; ux.page = 1; saveUX(); loadProducts(); });
});
