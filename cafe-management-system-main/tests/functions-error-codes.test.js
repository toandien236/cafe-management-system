const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeFirestoreErrorCode,
  mapFirestoreErrorCodeToCallableCode
} = require('../functions/services/errorCodes');
const { safeErrorDiagnostic } = require('../functions/services/safeDiagnostics');

test('normalizes numeric Firestore PERMISSION_DENIED to a callable permission error', () => {
  assert.equal(normalizeFirestoreErrorCode({ code: 7 }), 'permission-denied');
});

test('normalizes numeric Firestore NOT_FOUND and RESOURCE_EXHAUSTED statuses', () => {
  assert.equal(normalizeFirestoreErrorCode({ code: 5 }), 'not-found');
  assert.equal(normalizeFirestoreErrorCode({ code: 8 }), 'resource-exhausted');
  assert.equal(normalizeFirestoreErrorCode({ code: 9 }), 'failed-precondition');
});

test('maps a Firestore NOT_FOUND to failed-precondition so it is not mistaken for a missing callable', () => {
  assert.equal(mapFirestoreErrorCodeToCallableCode({ code: 5 }), 'failed-precondition');
  assert.equal(mapFirestoreErrorCodeToCallableCode({ code: '5 NOT_FOUND' }), 'failed-precondition');
});

test('normalizes named gRPC statuses and Firebase SDK-prefixed codes', () => {
  assert.equal(normalizeFirestoreErrorCode({ code: '5 NOT_FOUND' }), 'not-found');
  assert.equal(normalizeFirestoreErrorCode({ code: 'functions/permission-denied' }), 'permission-denied');
  assert.equal(normalizeFirestoreErrorCode({ code: 'FAILED_PRECONDITION' }), 'failed-precondition');
});

test('preserves application error codes and safely labels unknown values', () => {
  assert.equal(normalizeFirestoreErrorCode({ code: 'legacy-reservation-invalid' }), 'legacy-reservation-invalid');
  assert.equal(normalizeFirestoreErrorCode({ code: 1234 }), 'unknown');
  assert.equal(normalizeFirestoreErrorCode({}), 'unknown');
});

test('keeps a short error diagnostic while redacting contact details and credentials', () => {
  const diagnostic = safeErrorDiagnostic(new Error(
    'request for guest@example.com phone +1 (555) 555-0199 Bearer secret-value apiKey=AIzaSyDUMMYSECRET123456789012345678'
  ));

  assert.match(diagnostic, /\[email\]/);
  assert.match(diagnostic, /\[phone\]/);
  assert.match(diagnostic, /Bearer \[redacted\]/);
  assert.match(diagnostic, /apiKey=\[redacted\]/);
  assert.doesNotMatch(diagnostic, /guest@example\.com|555-0199|secret-value|AIzaSyDUMMYSECRET/i);
});
