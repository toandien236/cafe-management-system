const { createHash } = require('node:crypto');
const { tables: DEFAULT_TABLES, reservationDurationMinutes: DEFAULT_DURATION } = require('../config/tables');

const VALID_RESERVATION_TIMES = new Set([
  '0730', '0800', '0830', '0900', '0930', '1000', '1030', '1200',
  '1230', '1300', '1330', '1400', '1830', '1900', '1930', '2000'
]);
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeReservationInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createError('invalid-argument', 'Reservation details must be an object.');
  }
  const rawName = input.name ?? input.customerName ?? '';
  const rawEmail = input.email ?? '';
  const rawPhone = input.phone ?? '';
  const rawDate = input.date ?? '';
  const rawTime = input.time ?? '';
  const rawTableNumber = input.tableNumber ?? '';
  const rawNotes = input.specialRequest ?? input.notes ?? '';
  const requestId = input.requestId;
  if ([rawName, rawEmail, rawPhone, rawDate, rawTime, rawTableNumber, rawNotes].some(value => typeof value !== 'string')) {
    throw createError('invalid-argument', 'Reservation text fields must be strings.');
  }
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw createError('invalid-argument', 'A valid request ID is required.');
  }
  const name = rawName.trim();
  const email = rawEmail.trim().toLowerCase();
  const phone = rawPhone.trim();
  const date = rawDate.trim();
  const time = rawTime.trim();
  const tableNumber = normalizeTableNumber(rawTableNumber);
  const notes = rawNotes.trim();
  const guests = input.guests;

  if (!name || name.length > 120) throw createError('invalid-argument', 'Invalid customer name.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError('invalid-argument', 'Invalid customer email.');
  }
  if (phone.length > 40) throw createError('invalid-argument', 'Invalid customer phone.');
  if (!isValidCalendarDate(date)) throw createError('invalid-argument', 'Invalid reservation date.');
  if (date < getVietnamDateString()) {
    throw createError('invalid-argument', 'Reservation date cannot be in the past.');
  }
  if (!VALID_RESERVATION_TIMES.has(time)) throw createError('invalid-argument', 'Invalid reservation time.');
  if (!Number.isInteger(guests) || guests < 1 || guests > 12) {
    throw createError('invalid-argument', 'Invalid guest count.');
  }
  if (notes.length > 1000) throw createError('invalid-argument', 'Invalid reservation notes.');
  return { requestId, name, customerName: name, email, phone, date, time, guests, notes, specialRequest: notes, tableNumber };
}

function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getVietnamDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function normalizeTableNumber(value) {
  const number = String(value || '').trim().replace(/^B/i, '');
  return /^\d{1,2}$/.test(number) ? number.padStart(2, '0') : number;
}

function reservationStartMinutes(value) {
  const text = String(value && value.time || '').replace(':', '');
  if (!/^\d{4}$/.test(text)) throw createError('legacy-reservation-invalid', 'Invalid existing reservation time.');
  const hour = Number(text.slice(0, 2));
  const minute = Number(text.slice(2));
  if (hour > 23 || minute > 59) throw createError('legacy-reservation-invalid', 'Invalid existing reservation time.');
  return hour * 60 + minute;
}

function isActiveReservation(reservation) {
  return !['cancelled', 'canceled', 'deleted'].includes(String(reservation.status || 'pending').toLowerCase());
}

function intervalsOverlap(startA, startB, duration) {
  return startA < startB + duration && startB < startA + duration;
}

function planTableAssignments(existingReservations, newReservation, {
  tables = DEFAULT_TABLES,
  durationMinutes = DEFAULT_DURATION
} = {}) {
  const tableByNumber = new Map(tables.map(table => [normalizeTableNumber(table.tableNumber), table]));
  const occupancy = new Map(tables.map(table => [normalizeTableNumber(table.tableNumber), []]));
  const active = existingReservations
    .filter(entry => isActiveReservation(entry.data))
    .map(entry => ({
      ...entry,
      data: entry.data,
      start: reservationStartMinutes(entry.data),
      guests: Number(entry.data.guests)
    }))
    .sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id)));

  // Preserve existing assignments and treat them as fixed reservations.
  active.filter(entry => entry.data.tableNumber).forEach(entry => {
    const tableNumber = normalizeTableNumber(entry.data.tableNumber);
    const table = tableByNumber.get(tableNumber);
    if (!table || !Number.isInteger(entry.guests) || entry.guests < 1 || entry.guests > table.capacity) {
      throw createError('table-config-mismatch', 'Existing table assignment is outside the configured inventory.');
    }
    occupancy.get(tableNumber).push({ start: entry.start, reservationId: entry.id });
  });

  const tasks = active.filter(entry => !entry.data.tableNumber).map(entry => ({
    id: entry.id,
    ref: entry.ref,
    start: entry.start,
    guests: entry.guests,
    isNew: false
  }));
  tasks.push({
    id: newReservation.reservationId || 'new-reservation',
    start: reservationStartMinutes(newReservation),
    guests: Number(newReservation.guests),
    tableNumber: normalizeTableNumber(newReservation.tableNumber),
    isNew: true
  });
  tasks.sort((a, b) => a.start - b.start || Number(a.isNew) - Number(b.isNew) || String(a.id).localeCompare(String(b.id)));

  const legacyAssignments = [];
  let newTableNumber = '';
  const suitableTables = [...tables].sort((a, b) => a.capacity - b.capacity
    || normalizeTableNumber(a.tableNumber).localeCompare(normalizeTableNumber(b.tableNumber)));

  tasks.forEach(task => {
    if (!Number.isInteger(task.guests) || task.guests < 1 || task.guests > 12) {
      throw createError('legacy-reservation-invalid', 'Existing reservation has an invalid guest count.');
    }
    let table;
    if (task.isNew && task.tableNumber) {
      table = tableByNumber.get(task.tableNumber);
      if (!table) throw createError('table-not-configured', 'Selected table is not configured.');
      if (task.guests > table.capacity) {
        throw createError('table-capacity-exceeded', 'Selected table cannot seat this many guests.');
      }
      if ((occupancy.get(task.tableNumber) || []).some(occupied =>
        intervalsOverlap(task.start, occupied.start, durationMinutes))) {
        throw createError('table-not-available', 'Selected table is already occupied during this time.');
      }
    } else {
      table = suitableTables.find(candidate => {
        if (candidate.capacity < task.guests) return false;
        const tableNumber = normalizeTableNumber(candidate.tableNumber);
        return !(occupancy.get(tableNumber) || []).some(occupied =>
          intervalsOverlap(task.start, occupied.start, durationMinutes));
      });
    }
    if (!table) {
      throw createError(task.isNew ? 'no-available-table' : 'legacy-reservation-unassignable', 'No suitable table is available.');
    }

    const tableNumber = normalizeTableNumber(table.tableNumber);
    occupancy.get(tableNumber).push({ start: task.start, reservationId: task.id });
    if (task.isNew) newTableNumber = tableNumber;
    else legacyAssignments.push({ id: task.id, ref: task.ref, tableNumber });
  });

  return { tableNumber: newTableNumber, legacyAssignments };
}

async function createReservationWithTable(db, input, { serverTimestamp, tables, durationMinutes } = {}) {
  let normalizedReservation;
  try {
    normalizedReservation = normalizeReservationInput(input);
  } catch (error) {
    if (error && typeof error === 'object' && !error.step) error.step = 'validate-input';
    throw error;
  }
  const { requestId, ...reservation } = normalizedReservation;
  const requestFingerprint = createHash('sha256').update(JSON.stringify([
    reservation.name,
    reservation.email,
    reservation.phone,
    reservation.date,
    reservation.time,
    reservation.guests,
    reservation.notes,
    reservation.tableNumber
  ])).digest('hex');
  const timestamp = typeof serverTimestamp === 'function' ? serverTimestamp : () => new Date();
  const reservationRef = db.collection('reservations').doc();
  const requestRef = db.collection('reservationRequests').doc(requestId);
  const allocationRef = db.collection('tableAllocationDays').doc(reservation.date);
  const reservationQuery = db.collection('reservations').where('date', '==', reservation.date);
  let currentStep = 'read-request-record';
  let result = null;

  try {
    await db.runTransaction(async transaction => {
      let step = 'read-request-record';
      try {
        const requestSnapshot = await transaction.get(requestRef);
        if (requestSnapshot.exists) {
          const priorRequest = requestSnapshot.data() || {};
          if (typeof priorRequest.reservationId !== 'string' || typeof priorRequest.tableNumber !== 'string') {
            throw createError('idempotency-record-invalid', 'Existing request record is incomplete.');
          }
          if (priorRequest.requestFingerprint !== requestFingerprint) {
            throw createError('already-exists', 'Request ID is already associated with different booking details.');
          }

          step = 'verify-existing-reservation';
          currentStep = step;
          const priorReservationRef = db.collection('reservations').doc(priorRequest.reservationId);
          const priorReservationSnapshot = await transaction.get(priorReservationRef);
          const priorReservation = priorReservationSnapshot.exists ? priorReservationSnapshot.data() || {} : {};
          if (!priorReservationSnapshot.exists || priorReservation.tableNumber !== priorRequest.tableNumber) {
            throw createError('reservation-not-found', 'The reservation for this request no longer exists.');
          }
          result = { reservationId: priorRequest.reservationId, tableNumber: priorReservation.tableNumber };
          currentStep = 'commit-transaction';
          return;
        }

        step = 'read-day-allocation';
        currentStep = step;
        const allocationSnapshot = await transaction.get(allocationRef);
        step = 'read-same-day-reservations';
        currentStep = step;
        const reservationsSnapshot = await transaction.get(reservationQuery);
        const existingReservations = [];
        reservationsSnapshot.forEach(document => {
          if (document.id === reservationRef.id) return;
          const data = document.data() || {};
          if (String(data.date || '') !== reservation.date) return;
          existingReservations.push({ id: document.id, ref: document.ref, data });
        });

        step = 'plan-assignment';
        currentStep = step;
        const plan = planTableAssignments(existingReservations, { ...reservation, reservationId: reservationRef.id }, {
          ...(tables ? { tables } : {}),
          ...(durationMinutes ? { durationMinutes } : {})
        });
        const now = timestamp();
        result = { reservationId: reservationRef.id, tableNumber: plan.tableNumber };

        // All reads are complete before any write. Updating the per-day document
        // makes concurrent allocators for the same date contend and retry.
        step = 'write-legacy-table-assignments';
        currentStep = step;
        plan.legacyAssignments.forEach(assignment => {
          transaction.update(assignment.ref, { tableNumber: assignment.tableNumber, updatedAt: now });
        });
        step = 'create-reservation';
        currentStep = step;
        transaction.create(reservationRef, {
          ...reservation,
          reservationId: reservationRef.id,
          tableNumber: plan.tableNumber,
          status: 'pending',
          emailStatus: 'Pending',
          createdAt: now,
          updatedAt: now
        });
        step = 'save-idempotency-record';
        currentStep = step;
        transaction.create(requestRef, {
          reservationId: reservationRef.id,
          tableNumber: plan.tableNumber,
          requestFingerprint,
          createdAt: now
        });
        step = 'update-day-allocation';
        currentStep = step;
        const lockData = allocationSnapshot.exists ? allocationSnapshot.data() || {} : {};
        transaction.set(allocationRef, {
          date: reservation.date,
          revision: (Number(lockData.revision) || 0) + 1,
          updatedAt: now
        }, { merge: true });
        currentStep = 'commit-transaction';
      } catch (error) {
        if (error && typeof error === 'object' && !error.step) error.step = step;
        throw error;
      }
    });
  } catch (error) {
    if (error && typeof error === 'object' && !error.step) error.step = currentStep;
    throw error;
  }

  return result;
}

module.exports = {
  VALID_RESERVATION_TIMES,
  normalizeReservationInput,
  normalizeTableNumber,
  planTableAssignments,
  createReservationWithTable
};
