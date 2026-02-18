// E-commerce front-end: cart, product injection, local checkout (simulated)
(function(){
  const PRODUCTS_URL = 'products.json';
  const CART_KEY = 'cplink_cart_v1';

  let productsMap = {}; // name -> product

  const KES_FORMATTER = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 });
  function centsToStr(c){ return KES_FORMATTER.format(c/100); }

  async function loadProducts(){
    try{
      const res = await fetch(PRODUCTS_URL);
      const list = await res.json();
      list.forEach(p => productsMap[p.name.trim()] = p);
    }catch(e){console.warn('Could not load products.json', e)}
  }

  function getCart(){
    try{ return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }catch(e){return []}
  }
  function saveCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); renderCartCount(); }

  function addToCart(product){
    const cart = getCart();
    const existing = cart.find(i=>i.id===product.id);
    if(existing) existing.qty += 1; else cart.push({ ...product, qty:1 });
    saveCart(cart);
  }

  function renderCartCount(){
    const countEl = document.getElementById('cart-count');
    const cart = getCart();
    const total = cart.reduce((s,i)=>s+i.qty,0);
    if(countEl) countEl.textContent = total;
  }

  function renderCartModal(){
    const modal = document.getElementById('cart-modal');
    const itemsEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const cart = getCart();
    if(!itemsEl || !totalEl) return;
    itemsEl.innerHTML = '';
    let total = 0;
    cart.forEach(it=>{
      total += it.price_cents * it.qty;
      const row = document.createElement('div'); row.className='cart-row';
      row.innerHTML = `<div><strong>${it.name}</strong><div style="font-size:12px;color:#9fb7d9">${centsToStr(it.price_cents)} × ${it.qty}</div></div><div><button class="secondary" data-id="${it.id}" data-action="dec">−</button><button style="margin-left:6px" class="secondary" data-id="${it.id}" data-action="inc">+</button></div>`;
      itemsEl.appendChild(row);
    });
    totalEl.textContent = centsToStr(total);
  }

  function wireCartButtons(){
    document.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('button[data-action]');
      if(!btn) return;
      const id = btn.dataset.id; const action = btn.dataset.action;
      const cart = getCart();
      const item = cart.find(i=>i.id===id); if(!item) return;
      if(action==='inc') item.qty += 1; if(action==='dec') item.qty -= 1;
      const newCart = cart.filter(i=>i.qty>0);
      saveCart(newCart);
      renderCartModal();
    });
  }

  function openModal(id){ document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id){ document.getElementById(id).classList.add('hidden'); }

  function injectAddButtons(){
    const container = document.querySelector('#products');
    if(!container) return;
    const cards = Array.from(container.querySelectorAll('.glass-card'));
    cards.forEach(card=>{
      const titleEl = card.querySelector('h3');
      if(!titleEl) return;
      const name = titleEl.textContent.trim();
      const product = productsMap[name] || { id: name.toLowerCase().replace(/\s+/g,'-'), name, price_cents: 1500000 };
      // add price display and button
      const footer = card.querySelector('.p-6') || card;
      if(footer.querySelector('.price-row')) return; // already injected
      const priceRow = document.createElement('div'); priceRow.className='price-row';
      priceRow.innerHTML = `<div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between"><div style="font-weight:700">${centsToStr(product.price_cents)}</div><div><button class="primary add-btn" data-id="${product.id}" data-name="${encodeURIComponent(product.name)}">Add to cart</button></div></div>`;
      footer.appendChild(priceRow);
    });

    // wire add-to-cart
    document.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('button.add-btn'); if(!btn) return;
      const id = btn.dataset.id; const name = decodeURIComponent(btn.dataset.name || 'Product');
      const product = productsMap[name] || { id, name, price_cents: 1500000 };
      addToCart(product);
      renderCartModal();
      // brief confirmation
      btn.textContent = 'Added ✓'; setTimeout(()=>btn.textContent='Add to cart',800);
    });
  }

  function wireUI(){
    const cartBtn = document.getElementById('cart-button');
    const closeCart = document.getElementById('close-cart');
    const checkoutBtn = document.getElementById('checkout-btn');
    const closeCheckout = document.getElementById('close-checkout');
    const checkoutForm = document.getElementById('checkout-form');
    const closeOrder = document.getElementById('close-order');
    const sendInquiryBtn = document.getElementById('send-inquiry-btn');

    if(cartBtn) cartBtn.addEventListener('click', ()=>{ renderCartModal(); openModal('cart-modal'); });
    if(closeCart) closeCart.addEventListener('click', ()=>closeModal('cart-modal'));
    if(checkoutBtn) checkoutBtn.addEventListener('click', ()=>{ closeModal('cart-modal'); openModal('checkout-modal'); });
    if(closeCheckout) closeCheckout.addEventListener('click', ()=>closeModal('checkout-modal'));
    if(closeOrder) closeOrder.addEventListener('click', ()=>closeModal('order-confirm'));

    if(checkoutForm) checkoutForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const form = new FormData(checkoutForm);
      const name = form.get('name'); const email = form.get('email');
      const cart = getCart(); if(cart.length===0){ alert('Cart empty'); return; }

      // Try server-side Stripe checkout if available
      try{
        const resp = await fetch('/create-checkout-session', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({items: cart, customer:{name,email}})
        });
        if(resp.ok){ const j = await resp.json(); if(j.url){ window.location.href = j.url; return; } }
      }catch(e){ console.info('Stripe backend not available, falling back to simulated checkout'); }

      // Simulate order placement
      const orders = JSON.parse(localStorage.getItem('cplink_orders_v1')||'[]');
      orders.push({ id: 'ORD-'+Date.now(), name, email, items:cart, total: cart.reduce((s,i)=>s+i.price_cents*i.qty,0), created: new Date().toISOString() });
      localStorage.setItem('cplink_orders_v1', JSON.stringify(orders));
      localStorage.removeItem(CART_KEY);
      renderCartCount(); closeModal('checkout-modal');
      document.getElementById('order-message').textContent = `Thank you ${name}. Your order was placed (simulated).`;
      openModal('order-confirm');
    });

    if(sendInquiryBtn) sendInquiryBtn.addEventListener('click', ()=>{
      sendInquiryToWhatsApp();
    });
  }

  function sendInquiryToWhatsApp(){
    const cart = getCart(); if(!cart || cart.length===0){ alert('Cart is empty'); return; }
    const totalCents = cart.reduce((s,i)=>s + i.price_cents * i.qty, 0);
    let msg = `Hello CPLINK, I have an inquiry about these products:\n`;
    cart.forEach(it=>{ msg += `${it.qty} x ${it.name} - ${centsToStr(it.price_cents)}\n`; });
    msg += `Total: ${centsToStr(totalCents)}\n`;
    msg += `Please contact me to discuss availability and pricing.`;
    const phone = '254710241295';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  // Initialize
  (async function init(){
    await loadProducts();
    injectAddButtons();
    renderCartCount();
    wireCartButtons();
    wireUI();
  })();

})();
