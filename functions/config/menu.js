/**
 * Shared Cafe Menu catalog for server-side verification
 */
const MENU_ITEMS = [
  { id: 'espresso', name: 'Espresso hạt tuyển chọn', category: 'Cà phê', price: 35000 },
  { id: 'cappuccino', name: 'Cappuccino mịn màng', category: 'Cà phê', price: 45000 },
  { id: 'coldbrew', name: 'Cold brew ủ 18 giờ', category: 'Cà phê', price: 50000 },
  { id: 'matcha', name: 'Matcha latte Uji', category: 'Đồ uống', price: 55000 },
  { id: 'mocha', name: 'Mocha đá cacao đậm', category: 'Đồ uống', price: 55000 },
  { id: 'croissant', name: 'Croissant bơ ngàn lớp', category: 'Đồ ăn', price: 40000 },
  { id: 'pancake', name: 'Pancake soufflé bông xốp', category: 'Đồ ăn', price: 65000 },
  { id: 'brioche', name: 'Brioche gà hun khói', category: 'Đồ ăn', price: 75000 },
  { id: 'cheesecake', name: 'Cheesecake cháy kiểu Basque', category: 'Tráng miệng', price: 55000 },
  { id: 'linguine', name: 'Linguine hải sản miền biển', category: 'Đồ ăn', price: 95000 },
  { id: 'rose-coldbrew', name: 'Cold brew hoa hồng bạch đậu khấu', category: 'Cà phê', price: 55000 },
  { id: 'avocado-toast', name: 'Sourdough bơ quả nấm truffle', category: 'Đồ ăn', price: 70000 },
  { id: 'katsu-sando', name: 'Sandwich gà katsu giòn', category: 'Đồ ăn', price: 80000 },
  { id: 'matcha-opera', name: 'Bánh opera matcha lá vàng', category: 'Tráng miệng', price: 60000 },
  { id: 'raspberry-tart', name: 'Tart hồ trăn mâm xôi', category: 'Tráng miệng', price: 60000 }
];

const MENU_MAP = new Map(MENU_ITEMS.map(item => [item.id, item]));

module.exports = {
  MENU_ITEMS,
  MENU_MAP,
  getMenuItem(id) {
    return MENU_MAP.get(id) || null;
  }
};

