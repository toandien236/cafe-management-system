const assert = require('node:assert/strict');
const test = require('node:test');
const { mapOrder, mapReservation } = require('../scripts/migrate-firebase-to-supabase');

const firestoreTimestamp = iso => ({ toDate: () => new Date(iso) });

test('reservation migration maps Firestore fields and normalizes status', () => {
  const row = mapReservation({
    id: 'firebase-reservation-1',
    data: () => ({
      reservationId: 'RES-1',
      customerName: 'Mai Nguyen',
      email: 'mai@example.com',
      phone: '0900000000',
      date: '2026-10-19',
      time: '18:30',
      guests: 3,
      specialRequest: 'Bàn cạnh cửa sổ',
      status: 'Confirmed',
      emailStatus: 'Sent',
      createdAt: firestoreTimestamp('2026-10-18T08:00:00Z'),
      updatedAt: firestoreTimestamp('2026-10-18T09:00:00Z')
    })
  });

  assert.equal(row.source_firebase_id, 'firebase-reservation-1');
  assert.equal(row.reservation_id, 'RES-1');
  assert.equal(row.name, 'Mai Nguyen');
  assert.equal(row.notes, 'Bàn cạnh cửa sổ');
  assert.equal(row.status, 'confirmed');
  assert.equal(row.email_status, 'Sent');
  assert.equal(row.created_at, '2026-10-18T08:00:00.000Z');
});

test('order migration maps table, payment date, and legacy preparing status', () => {
  const row = mapOrder({
    id: 'firebase-order-1',
    data: () => ({
      orderId: 'ORD-1',
      tableNumber: 1,
      items: [{ id: 'espresso', name: 'Espresso', price: 35000, quantity: 1 }],
      total: 35000,
      status: 'preparing',
      paymentStatus: 'paid',
      paidAt: firestoreTimestamp('2026-10-19T12:00:00Z'),
      createdAt: firestoreTimestamp('2026-10-19T11:55:00Z')
    })
  });

  assert.equal(row.source_firebase_id, 'firebase-order-1');
  assert.equal(row.order_id, 'ORD-1');
  assert.equal(row.table_number, '01');
  assert.equal(row.status, 'in_progress');
  assert.equal(row.payment_status, 'paid');
  assert.equal(row.paid_at, '2026-10-19T12:00:00.000Z');
  assert.equal(row.total, 35000);
});

test('migration refuses to normalize an invalid order table number', () => {
  assert.throws(() => mapOrder({
    id: 'firebase-order-invalid',
    data: () => ({ orderId: 'ORD-X', tableNumber: 'Kitchen', items: [], total: 0 })
  }), /invalid table number/i);
});
