const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const menuSource = fs.readFileSync(path.join(root, 'js', 'menu-data.js'), 'utf8');
const orderSource = fs.readFileSync(path.join(root, 'js', 'order.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const orderHtml = fs.readFileSync(path.join(root, 'order.html'), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(menuSource, context);
const menu = context.window.CAFE_MENU;

test('homepage and table-order page use the same menu prices', () => {
  const cards = [...indexHtml.matchAll(/(<article\b[^>]*class="[^"]*\bmenu-card\b[^"]*"[^>]*>)([\s\S]*?)<\/article>/g)];
  const homePrices = new Map(cards.map(([, openingTag, card]) => {
    const id = openingTag.match(/\bdata-menu-id="([^"]+)"/)?.[1];
    const price = card.match(/class="menu-card-price">([\s\S]*?)<\/span>/)?.[1];
    assert.ok(id, 'homepage menu card has a shared menu ID');
    assert.ok(price, `homepage menu card ${id} has a price`);
    return [id, Number(price.replace(/[^\d]/g, ''))];
  }));

  assert.equal(menu.length, 15);
  assert.equal(homePrices.size, menu.length);
  for (const item of menu) {
    assert.equal(homePrices.get(item.id), item.price, `${item.name} has the same homepage and QR price`);
  }
  assert.match(orderSource, /const ORDER_MENU = window\.CAFE_MENU;/);
  assert.match(indexHtml, /js\/menu-data\.js/);
  assert.match(orderHtml, /js\/menu-data\.js/);
});
