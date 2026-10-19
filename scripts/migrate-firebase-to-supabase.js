const path = require('node:path');
const admin = require('firebase-admin');

const PAGE_SIZE = 250;
const UPSERT_SIZE = 100;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.MIGRATION_DRY_RUN === '1';
let firebaseApp = null;

function required(value, name) {
  if (!value) throw new Error(`${name} must be set in the environment.`);
  return value;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date value: ${String(value)}`);
  return date.toISOString();
}

function toReservationDate(value) {
  if (!value) throw new Error('Reservation is missing its date.');
  if (typeof value.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapReservation(doc) {
  const source = doc.data();
  const name = String(source.name || source.customerName || '').trim();
  const email = String(source.email || '').trim();
  const date = toReservationDate(source.date);
  const time = String(source.time || '').trim();
  const guests = Number(source.guests || 2);
  const status = String(source.status || 'pending').toLowerCase();
  const emailStatus = String(source.emailStatus || source.email_status || 'Pending').toLowerCase();
  if (!name || !email || !time || !Number.isInteger(guests) || guests < 1 || guests > 50) {
    throw new Error(`Reservation ${doc.id} is missing valid required fields.`);
  }
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    throw new Error(`Reservation ${doc.id} has unsupported status "${status}".`);
  }
  const emailStatusMap = { pending: 'Pending', sent: 'Sent', failed: 'Failed' };
  if (!emailStatusMap[emailStatus]) {
    throw new Error(`Reservation ${doc.id} has unsupported email status "${emailStatus}".`);
  }

  return {
    source_firebase_id: doc.id,
    reservation_id: String(source.reservationId || source.reservation_id || doc.id).slice(0, 50),
    name,
    email,
    phone: source.phone ? String(source.phone) : null,
    date,
    time,
    guests,
    notes: source.notes || source.specialRequest || source.special_request
      ? String(source.notes || source.specialRequest || source.special_request)
      : null,
    status,
    email_status: emailStatusMap[emailStatus],
    email_error: source.emailError || source.email_error
      ? String(source.emailError || source.email_error)
      : null,
    created_at: toIso(source.createdAt || source.created_at) || new Date(0).toISOString(),
    updated_at: toIso(source.updatedAt || source.updated_at) || toIso(source.createdAt || source.created_at) || new Date(0).toISOString()
  };
}

function mapOrder(doc) {
  const source = doc.data();
  const orderId = String(source.orderId || source.order_id || `LEGACY-${doc.id}`).slice(0, 50);
  const tableNumber = String(source.tableNumber || source.table_number || '').trim().padStart(2, '0');
  const items = Array.isArray(source.items) ? source.items : [];
  const total = Number(source.total);
  const rawStatus = String(source.status || 'new').toLowerCase();
  const status = rawStatus === 'preparing' ? 'in_progress' : rawStatus;
  const paymentStatus = String(source.paymentStatus || source.payment_status || 'unpaid').toLowerCase();
  if (!/^[0-9]{2}$/.test(tableNumber) || Number(tableNumber) < 1 || Number(tableNumber) > 99) {
    throw new Error(`Order ${doc.id} has an invalid table number.`);
  }
  if (!Number.isFinite(total) || total < 0 || !Array.isArray(source.items)) {
    throw new Error(`Order ${doc.id} has an invalid total or item list.`);
  }
  if (!['new', 'in_progress', 'served', 'completed', 'cancelled'].includes(status)) {
    throw new Error(`Order ${doc.id} has unsupported status "${rawStatus}".`);
  }
  if (!['unpaid', 'paid'].includes(paymentStatus)) {
    throw new Error(`Order ${doc.id} has unsupported payment status "${paymentStatus}".`);
  }

  return {
    source_firebase_id: doc.id,
    order_id: orderId,
    table_number: tableNumber,
    items,
    total,
    note: source.note ? String(source.note) : null,
    status,
    payment_status: paymentStatus,
    paid_at: toIso(source.paidAt || source.paid_at),
    created_at: toIso(source.createdAt || source.created_at) || new Date(0).toISOString(),
    updated_at: toIso(source.updatedAt || source.updated_at) || toIso(source.createdAt || source.created_at) || new Date(0).toISOString()
  };
}

async function upsertBatch(table, rows) {
  for (let start = 0; start < rows.length; start += UPSERT_SIZE) {
    const batch = rows.slice(start, start + UPSERT_SIZE);
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=source_firebase_id`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(batch)
      }
    );
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Supabase upsert failed for ${table} (HTTP ${response.status}): ${details}`);
    }
  }
}

async function migrateCollection(firestore, collectionName, tableName, mapper) {
  let lastDocument = null;
  let migratedCount = 0;
  while (true) {
    let query = firestore.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDocument) query = query.startAfter(lastDocument);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const rows = snapshot.docs.map(mapper);
    if (!DRY_RUN) await upsertBatch(tableName, rows);
    migratedCount += rows.length;
    lastDocument = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }
  console.log(`${DRY_RUN ? 'Validated' : 'Upserted'} ${migratedCount} ${collectionName} records.`);
}

async function main() {
  required(FIREBASE_PROJECT_ID, 'FIREBASE_PROJECT_ID');
  required(SUPABASE_URL, 'SUPABASE_URL');
  if (!DRY_RUN) required(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  const target = new URL(SUPABASE_URL);
  const isSupabaseCloud = target.protocol === 'https:'
    && target.hostname !== 'supabase.co'
    && target.hostname.endsWith('.supabase.co');
  const isLocalSupabase = ['localhost', '127.0.0.1'].includes(target.hostname);
  if (!DRY_RUN && !isSupabaseCloud && !isLocalSupabase) {
    throw new Error('SUPABASE_URL must point to a Supabase project over HTTPS or a local Supabase instance.');
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential = credentialPath
    ? admin.credential.cert(require(path.resolve(credentialPath)))
    : admin.credential.applicationDefault();
  firebaseApp = admin.initializeApp({ credential, projectId: FIREBASE_PROJECT_ID });
  const firestore = admin.firestore();

  await migrateCollection(firestore, 'reservations', 'reservations', mapReservation);
  await migrateCollection(firestore, 'orders', 'orders', mapOrder);
  console.log(DRY_RUN
    ? 'Dry run complete. No Supabase data was changed.'
    : 'Migration complete. Firebase source documents were not modified or deleted.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('[Firebase to Supabase migration failed]', error.message);
    process.exitCode = 1;
  }).finally(() => {
    if (firebaseApp) {
      return firebaseApp.delete().catch(error => {
        console.error('[Firebase to Supabase migration cleanup failed]', error.message);
        process.exitCode = 1;
      });
    }
  });
}

module.exports = { mapOrder, mapReservation };
