const GRPC_STATUS_CODES = Object.freeze({
  0: 'ok',
  1: 'cancelled',
  2: 'unknown',
  3: 'invalid-argument',
  4: 'deadline-exceeded',
  5: 'not-found',
  6: 'already-exists',
  7: 'permission-denied',
  8: 'resource-exhausted',
  9: 'failed-precondition',
  10: 'aborted',
  11: 'out-of-range',
  12: 'unimplemented',
  13: 'internal',
  14: 'unavailable',
  15: 'data-loss',
  16: 'unauthenticated'
});

function normalizeFirestoreErrorCode(error) {
  const rawCode = error && error.code;
  if (typeof rawCode === 'number' && Number.isInteger(rawCode)) {
    return GRPC_STATUS_CODES[rawCode] || 'unknown';
  }

  const code = String(rawCode || 'unknown')
    .trim()
    .replace(/^(?:firestore|functions)\//i, '')
    .trim()
    .toLowerCase();
  const grpcCode = code.match(/^(\d+)(?:\s+([a-z_]+))?$/);
  if (grpcCode) {
    if (GRPC_STATUS_CODES[Number(grpcCode[1])]) return GRPC_STATUS_CODES[Number(grpcCode[1])];
    if (grpcCode[2]) return grpcCode[2].replace(/_/g, '-');
    return 'unknown';
  }

  return code.replace(/_/g, '-');
}

function mapFirestoreErrorCodeToCallableCode(error) {
  const code = normalizeFirestoreErrorCode(error);
  return code === 'not-found' ? 'failed-precondition' : code;
}

module.exports = { normalizeFirestoreErrorCode, mapFirestoreErrorCodeToCallableCode };
