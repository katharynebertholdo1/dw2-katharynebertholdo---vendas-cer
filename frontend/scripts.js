// scripts.js
const API_URL = 'http://localhost:8000';

// Carrinho no localStorage
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Estado do cupom
let cupomAplicado = false;

// Funções de Utilidade
function formatPrice(price) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  updateCartDrawer();
}

// Funções do Carrinho
function updateCartCount() {
  const count = cart.reduce((total, item) => total + item.quantidade, 0);
  document.getElementById('cart-count').textContent = count;
}

function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const isHidden = drawer.getAttribute('aria-hidden') === 'true';
  drawer.setAttribute('aria-hidden', !isHidden);
}

function updateCartDrawer() {
  const cartItems = document.querySelector('.cart-items');
  const subtotalEl = document.getElementById('subtotal');
  const discountEl = document.getElementById('discount');
  const totalEl = document.getElementById('total');
  
  // Limpa items
  cartItems.innerHTML = '';
  
  // Calcula totais
  const subtotal = cart.reduce((total, item) => total + (item.preco * item.quantidade), 0);
  const discount = cupomAplicado ? subtotal * 0.1 : 0;
  const total = subtotal - discount;
  
  // Atualiza items
  cart.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.innerHTML = `
      <img src="https://via.placeholder.com/100" alt="${item.nome}">
      <div class="cart-item-details">
        <h3>${item.nome}</h3>
        <p class="cart-item-price">${formatPrice(item.preco)}</p>
        <div class="quantity-controls">
          <button onclick="updateQuantity(${item.id}, -1)" aria-label="Diminuir quantidade">-</button>
          <span>${item.quantidade}</span>
          <button onclick="updateQuantity(${item.id}, 1)" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
    `;
    cartItems.appendChild(itemEl);
  });
  
  // Atualiza totais
  subtotalEl.textContent = formatPrice(subtotal);
  discountEl.textContent = formatPrice(discount);
  totalEl.textContent = formatPrice(total);
}

function updateQuantity(produtoId, delta) {
  const item = cart.find(i => i.id === produtoId);
  if (item) {
    item.quantidade += delta;
    if (item.quantidade <= 0) {
      cart = cart.filter(i => i.id !== produtoId);
    }
    saveCart();
  }
}

function aplicarCupom() {
  const cupomInput = document.getElementById('cupom');
  const cupom = cupomInput.value.toUpperCase();
  
  if (cupom === 'ALUNO10') {
    cupomAplicado = true;
    alert('Cupom ALUNO10 aplicado com sucesso!');
    updateCartDrawer();
  } else {
    alert('Cupom inválido');
  }
}

async function finalizarCompra() {
  if (cart.length === 0) {
    alert('Carrinho vazio!');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/carrinho/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: cart.map(item => ({
          id: item.id,
          qtd: item.quantidade
        })),
        cupom: cupomAplicado ? 'ALUNO10' : ''
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(`Pedido #${result.pedido_id} confirmado! Total: ${formatPrice(result.total_final)}`);
      cart = [];
      saveCart();
      toggleCart();
    } else {
      const error = await response.json();
      alert(`Erro: ${error.detail}`);
    }
  } catch (err) {
    alert('Erro ao finalizar pedido');
  }
}

// Funções de Produtos
function addToCart(produto) {
  const existingItem = cart.find(item => item.id === produto.id);
  if (existingItem) {
    existingItem.quantidade++;
  } else {
    cart.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      quantidade: 1
    });
  }
  saveCart();
}

async function fetchProdutos(sort = '') {
  try {
    const response = await fetch(`${API_URL}/produtos${sort ? `?sort=${sort}` : ''}`);
    const data = await response.json();
    renderProdutos(data);
  } catch {
    alert('Erro ao carregar produtos');
  }
}

function renderProdutos(produtos) {
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  produtos.forEach(produto => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="https://via.placeholder.com/100" alt="${produto.nome}">
      <div class="name">${produto.nome}</div>
      <div class="price">${formatPrice(produto.preco)}</div>
      <div class="stock">${produto.estoque > 0 ? 'Em estoque' : 'Esgotado'}</div>
      <button 
        ${produto.estoque === 0 ? 'disabled' : ''}
        onclick="addToCart(${JSON.stringify(produto)})"
        aria-pressed="false"
        aria-label="Adicionar ${produto.nome} ao carrinho"
      >
        Adicionar ao carrinho
      </button>
    `;
    list.appendChild(card);
  });
}

// Admin Functions
function toggleAdminModal(show = true) {
  const modal = document.getElementById('admin-modal');
  modal.setAttribute('aria-hidden', !show);
}

async function handleProductSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const produto = Object.fromEntries(formData.entries());
  
  try {
    const response = await fetch(`${API_URL}/produtos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(produto)
    });
    
    if (response.ok) {
      alert('Produto cadastrado com sucesso!');
      toggleAdminModal(false);
      fetchProdutos();
    } else {
      const error = await response.json();
      alert(`Erro: ${error.detail}`);
    }
  } catch {
    alert('Erro ao cadastrar produto');
  }
}

// Toast Notification
function showToast(message, type = 'success') {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    stopOnFocus: true,
    style: {
      background: type === 'success' ? '#22c55e' : '#ef4444',
    }
  }).showToast();
}

// Tema Claro/Escuro
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  document.getElementById('theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
  showToast(`Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} ativado!`);
}

// Exportar dados
function exportData(format = 'json') {
  const products = Array.from(document.querySelectorAll('.card')).map(card => ({
    nome: card.querySelector('.name').textContent,
    preco: parseFloat(card.querySelector('.price').textContent.replace('R$', '').trim()),
    estoque: card.querySelector('.stock').textContent === 'Em estoque' ? 'Disponível' : 'Esgotado'
  }));

  if (format === 'csv') {
    const csv = [
      ['Nome', 'Preço', 'Estoque'],
      ...products.map(p => [p.nome, p.preco, p.estoque])
    ].map(row => row.join(',')).join('\\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos.csv';
    a.click();
  } else {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos.json';
    a.click();
  }
  
  showToast(`Lista exportada como ${format.toUpperCase()}!`);
}

// Infinite Scroll
let page = 1;
const perPage = 8;
let loading = false;

function handleInfiniteScroll() {
  const endOfPage = window.innerHeight + window.pageYOffset >= document.body.offsetHeight - 100;
  
  if (endOfPage && !loading) {
    loading = true;
    page++;
    fetchProdutos('', true).finally(() => {
      loading = false;
    });
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchProdutos();
  updateCartCount();
  
  // Cart Events
  document.getElementById('cart-icon').addEventListener('click', toggleCart);
  document.querySelector('.close-cart').addEventListener('click', toggleCart);
  document.getElementById('apply-cupom').addEventListener('click', aplicarCupom);
  document.getElementById('checkout').addEventListener('click', finalizarCompra);
  
  // Admin Form
  document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
  document.querySelector('.cancel-button').addEventListener('click', () => toggleAdminModal(false));
  
  // Sort Events
  document.getElementById('sort-select').addEventListener('change', (e) => {
    fetchProdutos(e.target.value);
    localStorage.setItem('lastSort', e.target.value);
  });
  
  // Restore last sort
  const lastSort = localStorage.getItem('lastSort');
  if (lastSort) {
    document.getElementById('sort-select').value = lastSort;
    fetchProdutos(lastSort);
  }
  
  // Search
  document.getElementById('search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      const name = card.querySelector('.name').textContent.toLowerCase();
      card.style.display = name.includes(searchTerm) ? '' : 'none';
    });
  });
  
  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  // Export Button
  document.getElementById('export-btn').addEventListener('click', () => {
    const format = confirm('Clique OK para exportar como JSON, ou Cancelar para CSV') ? 'json' : 'csv';
    exportData(format);
  });
  
  // Infinite Scroll
  window.addEventListener('scroll', handleInfiniteScroll);
  
  // Set initial theme button text
  const currentTheme = document.documentElement.getAttribute('data-theme');
  document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
});
