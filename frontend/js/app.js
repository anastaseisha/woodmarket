const $ = (selector) => document.querySelector(selector);
const money = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const api = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Не удалось выполнить запрос');
  return data;
};
const favorites = () => JSON.parse(localStorage.getItem('woodmarket-favorites') || '[]');
const isFavorite = (id) => favorites().includes(id);
function toggleFavorite(id) {
  const values = favorites();
  localStorage.setItem('woodmarket-favorites', JSON.stringify(values.includes(id) ? values.filter(v => v !== id) : [...values, id]));
  if (location.pathname.endsWith('favorites.html')) loadFavorites();
  else document.querySelectorAll(`[data-favorite="${id}"]`).forEach(b => { b.textContent = isFavorite(id) ? '♥' : '♡'; b.setAttribute('aria-label', isFavorite(id) ? 'Удалить из избранного' : 'Добавить в избранное'); });
}
function card(p) {
  return `<article class="product-card"><div class="product-image"><a href="product.html?id=${p.id}"><img src="${p.image}" alt="${p.name}" loading="lazy"></a><button class="favorite-btn" data-favorite="${p.id}" aria-label="${isFavorite(p.id) ? 'Удалить из избранного' : 'Добавить в избранное'}">${isFavorite(p.id) ? '♥' : '♡'}</button></div><div class="product-card-body"><h3>${p.name}</h3><p>Материал: ${p.material}</p><p class="price">от ${money(p.base_price)}</p><a class="button button-primary" href="product.html?id=${p.id}">Подробнее →</a></div></article>`;
}
document.addEventListener('click', e => { const button = e.target.closest('[data-favorite]'); if (button) toggleFavorite(Number(button.dataset.favorite)); });
async function loadCatalog() {
  const categories = await api('/api/categories');
  $('#categories').innerHTML = categories.map(c => `<label><input type="radio" name="category" value="${c.id}"> ${c.name}</label>`).join('');
  $('#materials').innerHTML = ['Сосна','Берёза','Лиственница','Дуб','Бук'].map(m => `<label><input type="radio" name="material" value="${m}"> ${m}</label>`).join('');
  const params = new URLSearchParams(location.search);
  if (params.has('category')) { const option = [...document.querySelectorAll('[name=category]')].find(x => x.value === params.get('category')); if(option) option.checked = true; }
  const render = async () => {
    $('#catalog-state').innerHTML = '';
    $('#products').innerHTML = '<p>Загрузка товаров…</p>';
    const q = new URLSearchParams({q: $('#search').value, category: $('[name=category]:checked').value, material: $('[name=material]:checked').value, sort: $('#sort').value});
    if ($('#min-price').value) q.set('min_price', $('#min-price').value);
    if ($('#max-price').value) q.set('max_price', $('#max-price').value);
    try {
      const data = await api('/api/products?' + q);
      $('#count').textContent = `Найдено товаров: ${data.length}`;
      $('#products').innerHTML = data.map(card).join('');
      if (!data.length) $('#catalog-state').innerHTML = '<h2>Товары не найдены</h2><p>Попробуйте изменить параметры поиска или сбросить фильтры</p><button class="button button-primary" id="empty-reset">Сбросить фильтры</button>';
    } catch (e) { $('#products').innerHTML = ''; $('#count').textContent = 'Ошибка'; $('#catalog-state').innerHTML = `<h2>Не удалось загрузить товары</h2><p>${e.message}</p><button class="button button-primary" id="retry">Попробовать снова</button>`; }
  };
  const reset = () => { $('#search').value = ''; $('[name=category][value=""]').checked = true; $('[name=material][value=""]').checked = true; $('#min-price').value = ''; $('#max-price').value = ''; $('#sort').value = ''; history.replaceState({}, '', 'catalog.html'); render(); };
  $('#search-form').addEventListener('submit', e => {e.preventDefault(); render();});
  $('#apply').addEventListener('click', render);
  $('#sort').addEventListener('change', render);
  $('#reset').addEventListener('click', reset);
  $('#catalog-state').addEventListener('click', e => {if (e.target.id === 'empty-reset') reset(); if (e.target.id === 'retry') render();});
  await render();
}
let selectedProduct;
const calcData = () => ({product_id: selectedProduct.id, length: Number($('#length').value), width: Number($('#width').value), height: Number($('#height').value), material: $('#material').value});
async function loadProduct() {
  const id = Number(new URLSearchParams(location.search).get('id'));
  try {
    selectedProduct = await api('/api/products/' + id);
    const p = selectedProduct;
    $('#crumb').textContent = p.name;
    $('#product-content').innerHTML = `<div class="product-gallery"><img src="${p.image}" alt="${p.name}"><h2>Описание</h2><p>${p.description}</p><p>Натуральные материалы · Индивидуальные размеры · Изготовление на заказ</p></div><div class="product-info"><h1>${p.name}</h1><p>${p.description}</p><dl><dt>Категория</dt><dd>${p.category}</dd><dt>Материал</dt><dd>${p.material}</dd><dt>Базовые размеры</dt><dd>${p.dimensions.length} × ${p.dimensions.width} × ${p.dimensions.height} мм</dd><dt>Базовая цена</dt><dd>от ${money(p.base_price)}</dd></dl><section class="calculator"><h2>Рассчитайте стоимость</h2><p>Укажите размеры изделия в миллиметрах</p><form id="calc-form"><div class="dimension-grid"><label>Длина, мм<input id="length" type="number" min="1" max="100000" required value="${p.dimensions.length}"></label><label>Ширина, мм<input id="width" type="number" min="1" max="100000" required value="${p.dimensions.width}"></label><label>Высота, мм<input id="height" type="number" min="1" max="100000" required value="${p.dimensions.height}"></label></div><label>Материал<select id="material">${p.materials.map(m => `<option ${m===p.material?'selected':''}>${m}</option>`).join('')}</select></label><div class="estimate"><small>Предварительная стоимость</small><strong id="estimate-price">Рассчитываем…</strong><small>Цена ориентировочная и уточняется производителем.</small></div><p id="calc-error" role="alert"></p><button type="button" id="request-open" class="button button-primary" disabled>Оставить заявку →</button></form></section></div>`;
    const recalc = async () => {
      $('#request-open').disabled = true;
      $('#calc-error').textContent = '';
      $('#estimate-price').textContent = 'Рассчитываем…';
      try {const result = await api('/api/calculate', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(calcData())}); $('#estimate-price').textContent = '≈ ' + money(result.estimated_price); $('#request-open').disabled = false;}
      catch(e) {$('#estimate-price').textContent = 'Расчёт недоступен'; $('#calc-error').textContent = e.message;}
    };
    $('#calc-form').addEventListener('input', recalc);
    $('#calc-form').addEventListener('change', recalc);
    $('#request-open').addEventListener('click', () => {$('#request-product-name').textContent = p.name + ' · ' + $('#estimate-price').textContent; $('#request-dialog').showModal();});
    $('#close-dialog').addEventListener('click', () => $('#request-dialog').close());
    $('#request-form').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type=submit]'); button.disabled = true;
      $('#request-message').textContent = 'Отправляем заявку…';
      try {
        await api('/api/requests', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...calcData(), ...Object.fromEntries(new FormData(form))})});
        form.innerHTML = `<div class="success"><h2>Заявка успешно отправлена!</h2><p>Демонстрационный режим: заявка не сохраняется и не передаётся продавцу.</p><button type="button" class="button button-primary" id="done">Закрыть</button></div>`;
        $('#done').addEventListener('click', () => $('#request-dialog').close());
      } catch(e) {$('#request-message').textContent = e.message; button.disabled = false;}
    });
    const related = (await api('/api/products')).filter(x => x.id !== p.id).slice(0,4);
    $('#related').innerHTML = related.map(card).join('');
    await recalc();
  } catch(e) {$('#product-content').innerHTML = `<p>Не удалось загрузить товар: ${e.message}. <a href="catalog.html">Вернуться в каталог</a></p>`;}
}
async function loadFavorites() {
  const ids = favorites();
  try {const all = await api('/api/products'); const found = all.filter(p => ids.includes(p.id)); $('#products').innerHTML = found.map(card).join(''); $('#catalog-state').textContent = found.length ? '' : 'В избранном пока нет товаров. Перейдите в каталог, чтобы добавить понравившиеся изделия.';}
  catch(e) {$('#catalog-state').textContent = e.message;}
}
if (location.pathname.endsWith('catalog.html')) loadCatalog().catch(e => {$('#catalog-state').textContent = e.message;});
if (location.pathname.endsWith('product.html')) loadProduct();
if (location.pathname.endsWith('favorites.html')) loadFavorites();
