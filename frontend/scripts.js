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

  function key(s){
    try { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
    catch(e){ return String(s).toLowerCase().trim(); }
  }

  // Imagens (catalog + carrinho) — chaves normalizadas
  const IMAGENS = {
    "lapis hb": "/static/assets/img/lapis-hb.jpg",
    "caneta azul": "/static/assets/img/Caneta azul.jpg",
    "caneta preta": "/static/assets/img/Caneta preta.jpg",
    "caneta vermelha": "/static/assets/img/Caneta vermelha.jpg",
    "borracha": "/static/assets/img/Borracha.jpg",
    "apontador": "/static/assets/img/Apontador.jpg",
    "regua 30cm": "/static/assets/img/regua-30cm.jpg",
    "caderno universitario": "/static/assets/img/caderno-universitario.jpg",
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

  /* ===== Acessibilidade: drawer ===== */
  const focusableSelector = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
  let lastFocus = null;
  function trapFocus(container, e){
    const f = Array.from(container.querySelectorAll(focusableSelector)).filter(el=>!el.hasAttribute('disabled'));
    if (f.length === 0) return;
    const first = f[0], last = f[f.length-1];
    if (e.key === 'Tab'){
      if (e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
    }
  }
  const openDrawer = () => {
    lastFocus = document.activeElement;
    drawer.classList.remove('hidden');
    btnCart.setAttribute('aria-expanded', 'true');
    btnCart.setAttribute('aria-pressed', 'true');
    btnClose.focus();
    drawer.addEventListener('keydown', onDrawerKeydown);
  };
  const closeDrawer = () => {
    drawer.classList.add('hidden');
    btnCart.setAttribute('aria-expanded', 'false');
    btnCart.setAttribute('aria-pressed', 'false');
    drawer.removeEventListener('keydown', onDrawerKeydown);
    if (lastFocus) lastFocus.focus(); else btnCart.focus();
  };
  function onDrawerKeydown(e){ trapFocus(drawer, e); if (e.key === 'Escape') closeDrawer(); }
  btnCart.addEventListener('click', openDrawer);
  btnClose.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.classList.contains('hidden')) closeDrawer(); });

  /* ===== Botões admin (editar/excluir) em cada card ===== */
  function productActions(p) {
    const wrap = document.createElement('div');
    wrap.className = 'product-actions';
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-icon';
    btnEdit.title = 'Editar'; btnEdit.setAttribute('aria-label', `Editar ${p.nome}`);
    btnEdit.textContent = '✏️';
    btnEdit.addEventListener('click', () => openForm('edit', p));

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon';
    btnDel.title = 'Excluir'; btnDel.setAttribute('aria-label', `Excluir ${p.nome}`);
    btnDel.textContent = '🗑️';
    btnDel.addEventListener('click', async () => {
      if (!confirm(`Excluir ${p.nome}?`)) return;
      try { await apiDelete(p.id); showToast('Produto excluído.'); await loadProducts(); }
      catch (err) { console.error(err); showToast('Erro ao excluir.'); }
    });

    wrap.append(btnEdit, btnDel);
    return wrap;
  }

  /* ===== Card do produto (thumb com fundo branco) ===== */
  function productCard(p) {
    const el = document.createElement('div');
    el.className = 'product-card';

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

    el.insertAdjacentHTML('beforeend', `
      <h3>${p.nome}</h3>
  <p class="price">R$ ${Number(p.preco).toFixed(2)}</p>
  <p class="stock" aria-live="polite">Em estoque: ${p.estoque}</p>
  <button class="btn btn-primary" aria-label="Adicionar ${p.nome} ao carrinho" ${p.estoque <= 0 ? 'disabled' : ''} class="btn btn-primary" aria-label="Adicionar ${p.nome} ao carrinho">Adicionar</button>
    `);
    el.appendChild(productActions(p));
    return el;
  }

  /* ===== UX persistida (filtros/ordem) ===== */
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

  /* ===== Carregar produtos (filtros + ordenação) ===== */
  async function loadProducts() {
    grid.setAttribute('aria-busy', 'true');
    statusBox.textContent = 'Carregando produtos...';
    applySkeleton();
    try {
      const params = new URLSearchParams();
      if (ux.text) params.set('search', ux.text);
      if (ux.categoria) params.set('categoria', ux.categoria);
      if (ux.sort) params.set('sort', ux.sort);

      const resp = await fetch(`http://127.0.0.1:8000/api/produtos?${params.toString()}`);
      if (!resp.ok) throw new Error('Falha ao carregar produtos');
      const data = await resp.json();
      window._lastList = Array.isArray(data) ? data.slice() : [];

      // categorias
      let categorias = [...new Set(data.map(p => p.categoria))].sort();
const __normalizeCat = (s) => (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
  categorias = categorias.filter(c => __normalizeCat(c) !== 'acessorios');
      selectCat.innerHTML = '<option value="">Todas categorias</option>' + categorias.map(c=>`<option value="${c}">${c}</option>`).join('');
      if (ux.categoria) selectCat.value = ux.categoria;

      // render
      grid.innerHTML = '';
      if (!Array.isArray(data) || data.length === 0) {
        statusBox.textContent = 'Nenhum produto disponível.';
      } else {
        data.forEach(p => grid.appendChild(productCard(p)));
        statusBox.textContent = `${data.length} produto(s) • página 1/1`;
      }

      // sem paginação por enquanto
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

  /* ===== Carrinho (localStorage) ===== */
  const CART_KEY = 'vendas_cart_v1';
  const cart = { items: {} }; // produtoId -> { produto, qtd }
  function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateBadge(); }
  function loadCart() { try { const v = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); if (v && v.items) Object.assign(cart, v); } catch {} updateBadge(); }
  function countItems() { return Object.values(cart.items).reduce((acc, it) => acc + it.qtd, 0); }
  function subtotal() { return Object.values(cart.items).reduce((acc, it) => acc + (Number(it.produto.preco) * it.qtd), 0); }
  const btnCartBadge = document.getElementById('btn-cart');
  function updateBadge() { btnCartBadge.dataset.count = String(countItems()); }
  loadCart();

  const cartItemsEl = document.getElementById('cart-items');
  const cartFooter = document.querySelector('.drawer-footer');
  const confirmBtn = cartFooter.querySelector('button.btn-primary');

  // Cupom + subtotal
  const couponWrap = document.createElement('div');
  couponWrap.className = 'form-row';
  couponWrap.innerHTML = `
    <div class="form-field"><label for="cupom">Cupom</label>
      <input id="cupom" type="text" placeholder="ALUNO10" />
    </div>
    <div class="form-field"><label>Subtotal</label><input id="subtotal" type="text" disabled /></div>
    <div class="form-field"><label>Desconto</label><input id="desconto" type="text" disabled /></div>
    <div class="form-field"><label>Total</label><input id="total" type="text" disabled /></div>
    <div class="form-field">
      <label>Ações</label>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button id="btn-apply-coupon" class="btn">Aplicar cupom</button>
        <button id="btn-review" class="btn btn-secondary" disabled>Revisar total</button>
      </div>
      <div id="cupom-status" class="hint" aria-live="polite" style="margin-top:4px"></div>
    </div>
  `;
  cartFooter.prepend(couponWrap);
  const couponInput   = couponWrap.querySelector('#cupom');
  const subtotalInput = couponWrap.querySelector('#subtotal');
  const descontoInput = couponWrap.querySelector('#desconto');
  const totalInput    = couponWrap.querySelector('#total');
  const btnApply      = couponWrap.querySelector('#btn-apply-coupon');
  const btnReview     = couponWrap.querySelector('#btn-review');
  const cupomStatusEl = couponWrap.querySelector('#cupom-status');

  // Estados possíveis: 'vazio' | 'digitando' | 'validado' | 'revisado'
  let cupomState = 'vazio';
  let cupomLocked = false;

  function computeTotalsFront(subtotal, cupom) {
    const sub = Number(subtotal) || 0;
    const code = (cupom || '').trim().toUpperCase();
    const desc = code === 'ALUNO10' ? +(sub * 0.10).toFixed(2) : 0;
    const tot  = Math.max(0, +(sub - desc).toFixed(2));
    return { desconto: desc, total: tot, valido: code === 'ALUNO10' };
  }

  function updateTotalsUI() {
    try {
      const entries = Object.values(cart.items || {});
      const subtotalNum = entries.reduce((acc, it) => acc + Number(it.produto.preco) * it.qtd, 0);
      const r = computeTotalsFront(subtotalNum, couponInput.value);
      subtotalInput.value = `R$ ${subtotalNum.toFixed(2)}`;
      descontoInput.value = `R$ ${r.desconto.toFixed(2)}`;
      totalInput.value    = `R$ ${r.total.toFixed(2)}`;
    } catch (e) {}
  }

  function setCupomState(next) {
    cupomState = next;
    if (cupomState === 'vazio') {
      btnApply.disabled = true;
      btnReview.disabled = true;
      cupomStatusEl.textContent = '';
      couponInput.disabled = false;
      cupomLocked = false;
    } else if (cupomState === 'digitando') {
      btnApply.disabled = false;
      btnReview.disabled = true;
      cupomStatusEl.textContent = '';
      couponInput.disabled = false;
      cupomLocked = false;
    } else if (cupomState === 'validado') {
      btnApply.disabled = true;
      btnReview.disabled = false;
      cupomStatusEl.textContent = 'Cupom válido. Revise o total antes de confirmar.';
      couponInput.disabled = false;
      cupomLocked = false;
    } else if (cupomState === 'revisado') {
      btnApply.disabled = true;
      btnReview.disabled = true;
      cupomStatusEl.textContent = 'Total revisado. Pode confirmar a compra.';
      couponInput.disabled = true; // trava para evitar troca depois da revisão
      cupomLocked = true;
    }
    // Se houver cupom preenchido mas não revisado, o botão Confirmar fica desabilitado
    try {
      const confirmBtn = document.querySelector('.drawer-footer button.btn-primary');
      if (!confirmBtn) return;
      const hasCupom = (couponInput.value || '').trim().length > 0;
      if (hasCupom) {
        confirmBtn.disabled = (cupomState !== 'revisado');
        confirmBtn.textContent = (cupomState === 'revisado') ? 'Confirmar compra' : 'Revise o total…';
      } else {
        // Sem cupom, fluxo normal
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Finalizar';
      }
    } catch {}
  }

  couponInput.addEventListener('input', () => {
    const val = (couponInput.value || '').trim();
    setCupomState(val ? 'digitando' : 'vazio');
    updateTotalsUI();
  });

  btnApply.addEventListener('click', (e) => {
    e.preventDefault();
    const entries = Object.values(cart.items || {});
    if (entries.length === 0) { showToast('Carrinho vazio.'); return; }
    const subtotalNum = entries.reduce((acc, it) => acc + Number(it.produto.preco) * it.qtd, 0);
    const r = computeTotalsFront(subtotalNum, couponInput.value);
    updateTotalsUI();
    if (!r.valido) {
      cupomStatusEl.textContent = 'Cupom inválido.';
      setCupomState('digitando');
      return;
    }
    cupomStatusEl.textContent = 'Cupom válido! Clique em Revisar total.';
    setCupomState('validado');
  });

  btnReview.addEventListener('click', (e) => {
    e.preventDefault();
    // Segunda etapa: revisão explícita do total
    updateTotalsUI();
    setCupomState('revisado');
  });

  // Estado inicial
  setCupomState('vazio');
  couponInput.addEventListener('focus', () => { if (!couponInput.value) setCupomState('digitando'); });
/* ===== Render do carrinho com ícones (–, +, lixeira) ===== */
  function renderCart() {
    cartItemsEl.innerHTML = '';
    const entries = Object.values(cart.items);
    if (entries.length === 0) {
      cartItemsEl.textContent = 'Seu carrinho está vazio.';
      subtotalInput.value = 'R$ 0,00';
      confirmBtn.disabled = true;
      return;
    updateTotalsUI();
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

          <div class="qty" style="display:flex;gap:6px;align-items:center">
            <button class="btn-ic" data-act="minus" aria-label="Diminuir quantidade" title="Diminuir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"></path>
              </svg>
            </button>

            <span aria-live="polite" style="min-width:24px;text-align:center">${qtd}</span>

            <button class="btn-ic" data-act="plus" aria-label="Aumentar quantidade" title="Aumentar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
            </button>

            <button class="btn-ic danger" data-act="remove" aria-label="Remover item" title="Remover">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      // Miniatura
      const thumbSrc = IMAGENS[key(produto.nome)];
      if (thumbSrc) {
        const img = document.createElement('img');
        img.src = thumbSrc;
        img.alt = `Imagem de ${produto.nome}`;
        const holder = row.querySelector('.cart-thumb');
        if (holder) holder.appendChild(img);
      }

      const btnMinus  = row.querySelector('button[data-act="minus"]');
      const btnPlus   = row.querySelector('button[data-act="plus"]');
      const btnRemove = row.querySelector('button[data-act="remove"]');

      btnMinus.addEventListener('click', () => {
        if (cart.items[produto.id].qtd > 1) { cart.items[produto.id].qtd--; saveCart(); renderCart(); }
      });
      btnPlus.addEventListener('click', () => {
        cart.items[produto.id].qtd++; saveCart(); renderCart();
      });
      btnRemove.addEventListener('click', () => {
        delete cart.items[produto.id]; saveCart(); renderCart();
      });

      cartItemsEl.appendChild(row);
    });

    subtotalInput.value = `R$ ${subtotal().toFixed(2)}`;
  }

  // Hook no catálogo: adicionar ao carrinho
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.btn.btn-primary');
    if (!btn) return;
    const card = btn.closest('.product-card');
    if (!card) return;
    const nameEl = card.querySelector('h3');
    const priceEl = card.querySelector('.price');
    const name = nameEl ? nameEl.textContent : 'Produto';
    const price = priceEl ? Number(priceEl.textContent.replace(/[^0-9.,]/g,'').replace(',','.')) : 0;

    fetch('http://127.0.0.1:8000/api/produtos').then(r=>r.json()).then(list => {
      const prod = list.find(p => p.nome === name && Number(p.preco).toFixed(2) === price.toFixed(2));
      if (!prod) { showToast('Produto não encontrado.'); return; }
      if (prod.estoque <= 0) { showToast('Sem estoque.'); return; }
      if (!cart.items[prod.id]) cart.items[prod.id] = { produto: prod, qtd: 0 };
      cart.items[prod.id].qtd++;
      saveCart(); renderCart(); showToast('Adicionado ao carrinho.');
    });
  });

  // Confirmar compra
  confirmBtn.addEventListener('click', async () => {
    const entries = Object.values(cart.items);
    if (entries.length === 0) return;
    confirmBtn.disabled = true; confirmBtn.textContent = 'Confirmando...';
    try {
      const payload = {
        itens: entries.map(({ produto, qtd }) => ({ produto_id: produto.id, quantidade: qtd })),
        cupom: couponInput.value.trim() || null,
      };
      const resp = await fetch('http://127.0.0.1:8000/api/carrinho/confirmar', {
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
      confirmBtn.disabled = false; confirmBtn.textContent = 'Finalizar';
    }
  });

  btnCart.addEventListener('click', renderCart);

  /* ===== Toast ===== */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  /* ===== Form de produto ===== */
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
      form.reset(); fid.id.value = '';
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

  async function apiCreate(body) {
    const resp = await fetch('http://127.0.0.1:8000/api/produtos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw await resp.json();
    return resp.json();
  }
  async function apiUpdate(id, body) {
    const resp = await fetch(`http://127.0.0.1:8000/api/produtos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw await resp.json();
    return resp.json();
  }
  async function apiDelete(id) {
    const resp = await fetch(`http://127.0.0.1:8000/api/produtos/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw await resp.json();
  }

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
      if (id) { await apiUpdate(id, body); showToast('Produto atualizado.'); }
      else { await apiCreate(body); showToast('Produto criado.'); }
      closeForm(); await loadProducts();
    } catch (err) {
      console.error(err);
      const msg = (err && err.detail && (err.detail.erro || err.detail)) || 'Erro ao salvar produto.';
      showToast(typeof msg === 'string' ? msg : 'Erro ao salvar produto.');
    }
  });

  field('btn-cancel').addEventListener('click', (e) => { e.preventDefault(); closeForm(); });

  /* ===== Export CSV/JSON — Excel-friendly (UTF-16 LE) ===== */
  function toCSV(rows) {
    const DELIM = ';';
    const headers = ["nome","preco","estoque","categoria","sku"];
    const lines = [];
    lines.push("sep=" + DELIM);
    lines.push(headers.join(DELIM));
    if (!rows || !rows.length) return lines.join("\n");

    function esc(val) {
      if (val == null) return "";
      let v = String(val).replace(/\r\n|\r|\n/g, "\n").replace(/"/g, '""');
      if (v.includes(DELIM) || v.includes('"') || v.includes('\n')) v = `"${v}"`;
      return v;
    }

    for (const r of rows) {
      const preco = (typeof r.preco === 'number' ? r.preco : Number(r.preco || 0));
      const precoBR = preco.toFixed(2).replace('.', ',');
      lines.push([
        esc(r.nome || ""),
        esc(precoBR),
        esc(r.estoque ?? ""),
        esc(r.categoria || ""),
        esc(r.sku || "")
      ].join(DELIM));
    }
    return lines.join("\n");
  }

  function downloadCSV_UTF16LE(filename, text) {
    const utf16 = new Uint16Array(text.length + 1);
    utf16[0] = 0xFEFF; // BOM
    for (let i = 0; i < text.length; i++) utf16[i + 1] = text.charCodeAt(i);
    const blob = new Blob([utf16], { type: "text/csv;charset=utf-16le" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function download(filename, text, type="text/plain") {
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  async function exportCurrent(kind) {
    const params = new URLSearchParams();
    if (ux.text) params.set('search', ux.text);
    if (ux.categoria) params.set('categoria', ux.categoria);
    if (ux.sort) params.set('sort', ux.sort);

    let list;
    try {
      const resp = await fetch(`http://127.0.0.1:8000/api/produtos?${params.toString()}`);
      list = await resp.json();
    } catch(e) {
      list = Array.isArray(window._lastList) ? window._lastList : [];
    }

    if (kind === 'csv') {
      const csv = toCSV(list);
      downloadCSV_UTF16LE(`catalogo_${new Date().toISOString().slice(0,10)}.csv`, csv);
      showToast('Catálogo exportado em CSV.');
    } else {
      download(`catalogo_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(list, null, 2), "application/json");
      showToast('Catálogo exportado em JSON.');
    }
  }

  const btnExportCSV = document.getElementById('btn-export-csv');
  const btnExportJSON = document.getElementById('btn-export-json');
  if (btnExportCSV) btnExportCSV.addEventListener('click', () => exportCurrent('csv'));
  if (btnExportJSON) btnExportJSON.addEventListener('click', () => exportCurrent('json'));

  /* ===== Filtros e ordenação (persistidos) ===== */
  inputText.addEventListener('input', () => { ux.text = inputText.value.trim(); ux.page = 1; saveUX(); loadProducts(); });
  selectCat.addEventListener('change', () => { ux.categoria = selectCat.value; ux.page = 1; saveUX(); loadProducts(); });
  selectSort.addEventListener('change', () => { ux.sort = selectSort.value; ux.page = 1; saveUX(); loadProducts(); });
});
