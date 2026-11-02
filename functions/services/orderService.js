const { createHash } = require('node:crypto');
const { getMenuItem } = require('../config/menu');

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeTableNumber(rawTable) {
  const table = String(rawTable || '').trim().padStart(2, '0');
  if (!/^\d{2}$/.test(table) || Number(table) < 1 || Number(table) > 99) {
    throw createError('invalid-argument', 'Số bàn không hợp lệ (hỗ trợ từ bàn 01 đến bàn 99).');
  }
  return table;
}

function computeOrderPayloadHash(tableNumber, items, note) {
  const canonical = JSON.stringify({
    tableNumber,
    items: items.map(i => ({ id: i.id, quantity: i.quantity })).sort((a, b) => a.id.localeCompare(b.id)),
    note: String(note || '').trim()
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Validates order inputs and calculates price and total against authoritative menu data.
 * Rejects tampered prices, invalid item IDs, or out-of-range quantities.
 */
function validateAndCalculateOrder(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createError('invalid-argument', 'Dữ liệu đơn hàng không hợp lệ.');
  }

  const tableNumber = normalizeTableNumber(input.tableNumber);
  const rawItems = input.items;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createError('invalid-argument', 'Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 món.');
  }

  if (rawItems.length > 20) {
    throw createError('invalid-argument', 'Số lượng loại món trong một đơn vượt quá giới hạn (tối đa 20 món).');
  }

  const verifiedItems = [];
  let calculatedTotal = 0;

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') {
      throw createError('invalid-argument', 'Thông tin món không hợp lệ.');
    }

    const itemId = String(rawItem.id || '').trim();
    const menuItem = getMenuItem(itemId);

    if (!menuItem) {
      throw createError('invalid-argument', `Món "${itemId}" không tồn tại trong thực đơn của quán.`);
    }

    const quantity = Number(rawItem.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw createError('invalid-argument', `Số lượng cho món "${menuItem.name}" phải là số nguyên từ 1 đến 50.`);
    }

    const linePrice = menuItem.price;
    const lineTotal = linePrice * quantity;
    calculatedTotal += lineTotal;

    verifiedItems.push({
      id: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      price: linePrice,
      quantity
    });
  }

  const note = String(input.note || '').trim().slice(0, 300);
  const requestId = input.requestId ? String(input.requestId).trim() : null;

  if (requestId && !REQUEST_ID_PATTERN.test(requestId)) {
    throw createError('invalid-argument', 'Khóa idempotency (requestId) không hợp lệ.');
  }

  const payloadHash = computeOrderPayloadHash(tableNumber, verifiedItems, note);

  return {
    tableNumber,
    items: verifiedItems,
    total: calculatedTotal,
    note,
    requestId,
    payloadHash
  };
}

/**
 * Creates an order in Firestore with idempotency and server verification.
 */
async function createVerifiedOrder(db, input, options = {}) {
  const verified = validateAndCalculateOrder(input);
  const nowIso = new Date().toISOString();
  const orderId = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // If requestId is provided, check for idempotency
  if (verified.requestId) {
    const existingSnap = await db.collection('orders')
      .where('requestId', '==', verified.requestId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data();
      return {
        id: existingDoc.id,
        orderId: existingData.orderId || existingDoc.id,
        ...existingData,
        isDuplicate: true
      };
    }
  }

  const orderData = {
    orderId,
    requestId: verified.requestId || null,
    payloadHash: verified.payloadHash,
    tableNumber: verified.tableNumber,
    items: verified.items,
    total: verified.total,
    note: verified.note,
    status: 'new',
    paymentStatus: 'unpaid',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const docRef = await db.collection('orders').add(orderData);

  return {
    id: docRef.id,
    orderId,
    ...orderData,
    isDuplicate: false
  };
}

module.exports = {
  normalizeTableNumber,
  validateAndCalculateOrder,
  createVerifiedOrder,
  computeOrderPayloadHash
};

