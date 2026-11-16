const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');

const TABLES = ['inventory', 'stock_imports', 'stock_exports'];
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 400;

function getFirebaseProjectId() {
  const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
  try {
    const config = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    const projectId = config.projects && config.projects.default;
    if (typeof projectId !== 'string' || !projectId.trim()) {
      throw new Error('The .firebaserc file does not select a default Firebase project.');
    }
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== projectId) {
      throw new Error('FIREBASE_PROJECT_ID must match the existing .firebaserc project.');
    }
    return projectId;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    if (error.message.includes('.firebaserc') || error.message.includes('FIREBASE_PROJECT_ID')) throw error;
    throw new Error(`Could not read Firebase project selection: ${error.message}`);
  }
}

function legacyDocumentId(id) {
  const value = String(id || '').trim();
  if (!value) throw new Error('Legacy record is missing its id.');
  return `legacy-${Buffer.from(value, 'utf8').toString('base64url')}`;
}

function toNumber(value, field, recordId) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Invalid ${field} in Supabase record ${recordId}.`);
  }
  return number;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date value: ${value}`);
  return date;
}

function dateOnly(value) {
  if (!value) return '';
  const date = toDate(value);
  return date.toISOString().slice(0, 10);
}

function mapInventory(row, latestReceiptDate) {
  return {
    code: `NL-${String(row.id).toUpperCase()}`,
    name: String(row.name || '').trim(),
    category: String(row.category || 'Khác'),
    quantity: toNumber(row.quantity, 'quantity', row.id),
    unit: String(row.unit || ''),
    min_stock: toNumber(row.min_stock, 'min_stock', row.id),
    price: toNumber(row.price, 'price', row.id),
    supplier: String(row.supplier || ''),
    received_at: dateOnly(latestReceiptDate || row.updated_at || row.created_at),
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
    legacy_supabase_id: String(row.id),
    source: 'supabase-migration'
  };
}

function mapStockMovement(row, inventoryIds, tableName) {
  const itemId = row.item_id == null ? null : String(row.item_id);
  const mapped = {
    item_id: itemId && inventoryIds.has(itemId) ? inventoryIds.get(itemId) : null,
    item_code: itemId ? `NL-${itemId.toUpperCase()}` : '',
    item_name: String(row.item_name || ''),
    quantity: toNumber(row.quantity, 'quantity', row.id),
    unit: String(row.unit || ''),
    created_by: row.created_by == null ? null : String(row.created_by),
    actor_name: String(row.actor_name || ''),
    note: String(row.note || ''),
    created_at: toDate(row.created_at),
    legacy_supabase_id: String(row.id),
    source: 'supabase-migration'
  };

  if (tableName === 'stock_imports') {
    return {
      ...mapped,
      cost_price: toNumber(row.cost_price, 'cost_price', row.id),
      total_cost: toNumber(row.total_cost, 'total_cost', row.id),
      supplier: String(row.supplier || ''),
      batch_number: row.batch_number == null ? null : String(row.batch_number),
      expiry_date: row.expiry_date ? dateOnly(row.expiry_date) : null,
      received_at: row.created_at ? dateOnly(row.created_at) : ''
    };
  }

  return { ...mapped, reason: String(row.reason || '') };
}

function latestReceiptDates(imports) {
  const latest = new Map();
  imports.forEach(row => {
    if (!row.item_id || !row.created_at) return;
    const key = String(row.item_id);
    const date = toDate(row.created_at);
    if (!latest.has(key) || date > latest.get(key)) latest.set(key, date);
  });
  return latest;
}

async function fetchSupabaseTable(tableName, { url, anonKey, accessToken }) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const endpoint = new URL(`/rest/v1/${tableName}?select=*&order=id.asc`, url);
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Range-Unit': 'items',
        Range: `${offset}-${offset + PAGE_SIZE - 1}`
      }
    });
    if (!response.ok) {
      throw new Error(`Supabase read failed for ${tableName}: HTTP ${response.status}.`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Supabase returned an invalid ${tableName} response.`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function copyWithoutOverwriting(firestore, collectionName, records, mapper, dryRun) {
  let inserted = 0;
  let skipped = 0;
  const collection = firestore.collection(collectionName);

  for (let offset = 0; offset < records.length; offset += WRITE_BATCH_SIZE) {
    const chunk = records.slice(offset, offset + WRITE_BATCH_SIZE);
    const prepared = chunk.map(record => ({
      reference: collection.doc(legacyDocumentId(record.id)),
      data: mapper(record)
    }));
    const snapshots = await Promise.all(prepared.map(entry => entry.reference.get()));
    const missing = prepared.filter((entry, index) => !snapshots[index].exists);
    skipped += prepared.length - missing.length;
    if (!dryRun && missing.length) {
      const batch = firestore.batch();
      missing.forEach(entry => batch.create(entry.reference, entry.data));
      await batch.commit();
    }
    inserted += missing.length;
  }

  return { inserted, skipped };
}

async function migrate({ dryRun = false } = {}) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!url || !anonKey || !accessToken) {
    throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_ACCESS_TOKEN.');
  }

  if (!admin.apps.length) {
    const projectId = getFirebaseProjectId();
    if (!projectId) throw new Error('The existing Firebase project is not selected in .firebaserc.');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId
    });
  }
  const firestore = admin.firestore();
  const [inventory, imports, exports] = await Promise.all(
    TABLES.map(tableName => fetchSupabaseTable(tableName, { url, anonKey, accessToken }))
  );
  const receiptDates = latestReceiptDates(imports);
  const inventoryIds = new Map(inventory.map(row => [
    String(row.id),
    legacyDocumentId(row.id)
  ]));

  const results = {};
  results.inventory = await copyWithoutOverwriting(
    firestore,
    'inventory',
    inventory,
    row => mapInventory(row, receiptDates.get(String(row.id))),
    dryRun
  );
  results.stock_imports = await copyWithoutOverwriting(
    firestore,
    'stock_imports',
    imports,
    row => mapStockMovement(row, inventoryIds, 'stock_imports'),
    dryRun
  );
  results.stock_exports = await copyWithoutOverwriting(
    firestore,
    'stock_exports',
    exports,
    row => mapStockMovement(row, inventoryIds, 'stock_exports'),
    dryRun
  );
  return results;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  migrate({ dryRun })
    .then(results => {
      console.log(`${dryRun ? 'Dry run' : 'Migration'} completed. Source Supabase records were not modified.`);
      Object.entries(results).forEach(([collection, result]) => {
        console.log(`${collection}: ${result.inserted} to copy, ${result.skipped} already present.`);
      });
    })
    .catch(error => {
      console.error(`Inventory migration failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  getFirebaseProjectId,
  legacyDocumentId,
  mapInventory,
  mapStockMovement,
  latestReceiptDates,
  copyWithoutOverwriting
};
