const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

const {
  getInitialConfirmationEmail,
  getConfirmedEmail,
  getCancelledEmail
} = require('./templates/emailTemplates');
const smsService = require('./services/smsService');
const { createReservationWithTable } = require('./services/tableAssignment');
const {
  normalizeFirestoreErrorCode,
  mapFirestoreErrorCodeToCallableCode
} = require('./services/errorCodes');
const { safeErrorDiagnostic } = require('./services/safeDiagnostics');

admin.initializeApp();
const TABLE_ASSIGNMENT_FUNCTION_REGION = 'us-central1';

/**
 * Configure Nodemailer Transporter
 * Reads from .env file (deployed securely alongside functions).
 * Gmail App Passwords may contain spaces — strip them before use.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  // Strip spaces from Gmail App Password (e.g. "uxnf rcic esnm vogx" -> "uxnfrcicesmnvogx")
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || '';
  const pass = rawPass.replace(/\s+/g, '');

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }

  // Fallback: log-only transport for testing when credentials are not set
  console.warn('[Mailer] No SMTP credentials found — using JSON transport (emails will be logged, not sent).');
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = createTransporter();
const SENDER_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'reservations@mochaandmiso.com';

/**
 * Create a reservation and assign its table in one server transaction.
 * The per-date coordination document serializes concurrent assignments.
 */
exports.createReservationWithTable = functions
  .region(TABLE_ASSIGNMENT_FUNCTION_REGION)
  .https.onCall(async (data) => {
  try {
    return await createReservationWithTable(admin.firestore(), data, {
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    const firestoreCode = normalizeFirestoreErrorCode(error);
    // A Firestore NOT_FOUND is an operation/data failure, not evidence that
    // the callable endpoint itself is missing. Reserve callable not-found for
    // the client-side endpoint lookup error.
    const code = mapFirestoreErrorCodeToCallableCode(error);
    const requestId = data && typeof data.requestId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)
      ? data.requestId
      : null;
    const step = String(error && error.step || 'callable-handler').slice(0, 60);
    console.error('[table-assignment] reservation request failed', {
      code,
      firestoreCode,
      step,
      requestId,
      errorType: String(error && error.name || 'Error'),
      rawCodeType: error && typeof error.code || 'undefined',
      diagnostic: safeErrorDiagnostic(error)
    });

    if (error instanceof functions.https.HttpsError) throw error;
    if (code === 'invalid-argument') {
      throw new functions.https.HttpsError('invalid-argument', 'Thông tin đặt bàn không hợp lệ.');
    }
    if (code === 'no-available-table') {
      throw new functions.https.HttpsError('resource-exhausted', 'Khung giờ này không còn bàn phù hợp.');
    }
    if (code === 'resource-exhausted') {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Firestore đang quá tải hoặc đã chạm giới hạn tạm thời. Vui lòng thử lại sau.',
        { reason: 'firestore-resource-exhausted' }
      );
    }
    if (code === 'table-not-available') {
      throw new functions.https.HttpsError('resource-exhausted', 'Bàn đã chọn không còn trống vào thời gian này. Vui lòng chọn bàn khác.', { reason: 'table-not-available' });
    }
    if (code === 'table-capacity-exceeded') {
      throw new functions.https.HttpsError('invalid-argument', 'Bàn đã chọn không đủ sức chứa cho số khách.', { reason: 'table-capacity-exceeded' });
    }
    if (code === 'table-not-configured') {
      throw new functions.https.HttpsError('failed-precondition', 'Số bàn đã chọn chưa được cấu hình tại quán.');
    }
    if (['table-config-mismatch', 'legacy-reservation-invalid', 'legacy-reservation-unassignable'].includes(code)) {
      throw new functions.https.HttpsError('failed-precondition', 'Dữ liệu bàn của lịch đặt cũ cần được nhân viên kiểm tra.');
    }
    if (code === 'failed-precondition') {
      throw new functions.https.HttpsError('failed-precondition', 'Máy chủ không thể xác nhận an toàn dữ liệu đặt bàn. Hãy thử lại cùng thông tin hoặc liên hệ quán.');
    }
    if (['idempotency-record-invalid', 'reservation-not-found'].includes(code)) {
      throw new functions.https.HttpsError('failed-precondition', 'Yêu cầu đã xử lý trước đó cần được kiểm tra; chưa tạo đặt bàn khác.');
    }
    if (code === 'already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Mã yêu cầu đã được dùng cho thông tin đặt bàn khác.');
    }
    if (code === 'permission-denied') {
      throw new functions.https.HttpsError('permission-denied', 'Máy chủ không có quyền ghi đặt bàn vào Firestore.');
    }
    if (['aborted', 'cancelled', 'unavailable', 'deadline-exceeded'].includes(code)) {
      throw new functions.https.HttpsError(code, 'Giao dịch đặt bàn chưa trả về kết quả xác nhận.');
    }
    if (code === 'unauthenticated') {
      throw new functions.https.HttpsError('unauthenticated', 'Máy chủ không xác thực được yêu cầu đặt bàn.');
    }
    throw new functions.https.HttpsError('internal', 'Máy chủ không thể hoàn tất giao dịch đặt bàn.');
  }
});

/**
 * Helper to safely dispatch email and update Firestore status
 */
async function sendEmailAndUpdateStatus(docRef, recipientEmail, mailOptions) {
  if (!recipientEmail) {
    console.warn(`[Cloud Functions] Missing email address for doc ${docRef.id}`);
    await docRef.update({ emailStatus: 'Failed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Mocha & Miso Craft Café" <${SENDER_EMAIL}>`,
      to: recipientEmail,
      subject: mailOptions.subject,
      html: mailOptions.html
    });

    console.log(`[Cloud Functions Email Sent] Message ID: ${info.messageId || 'DEV_STREAM'} to ${recipientEmail}`);

    await docRef.update({
      emailStatus: 'Sent',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error(`[Cloud Functions Email Error] Failed to send email to ${recipientEmail}:`, error);

    // Reservation remains saved! Mark emailStatus as Failed.
    await docRef.update({
      emailStatus: 'Failed',
      emailError: error.message || 'Transmission failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error('Failed to update emailStatus field:', err));
  }
}

/**
 * 1. Firestore Trigger: onCreate
 * Automatically sends initial confirmation email immediately after reservation is created.
 */
exports.onReservationCreated = functions.firestore
  .document('reservations/{resId}')
  .onCreate(async (snap, context) => {
    const res = snap.data();
    const resId = context.params.resId;
    res.id = res.id || resId;
    res.reservationId = res.reservationId || resId;

    console.log(`[onReservationCreated] New reservation created: ${resId} for ${res.email}`);

    // Generate initial confirmation email
    const mailOptions = getInitialConfirmationEmail(res);

    // Dispatch email
    await sendEmailAndUpdateStatus(snap.ref, res.email, mailOptions);

    // SMS readiness trigger (optional)
    if (res.phone) {
      await smsService.sendSMS(res.phone, `Mocha & Miso: Đã nhận yêu cầu đặt bàn ${res.reservationId} của bạn vào ngày ${res.date}, lúc ${res.time}.`);
    }
  });

/**
 * 2. Firestore Trigger: onUpdate
 * Automatically sends follow-up email when Admin changes status to "Confirmed" or "Cancelled".
 */
exports.onReservationStatusUpdated = functions.firestore
  .document('reservations/{resId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const resId = context.params.resId;
    afterData.id = afterData.id || resId;
    afterData.reservationId = afterData.reservationId || resId;

    // Check if status changed
    const oldStatus = (beforeData.status || '').toLowerCase();
    const newStatus = (afterData.status || '').toLowerCase();

    if (oldStatus === newStatus) {
      return null;
    }

    console.log(`[onReservationStatusUpdated] Reservation ${resId} status changed from "${oldStatus}" to "${newStatus}"`);

    let mailOptions = null;
    if (newStatus === 'confirmed') {
      mailOptions = getConfirmedEmail(afterData);
    } else if (newStatus === 'cancelled') {
      mailOptions = getCancelledEmail(afterData);
    }

    if (mailOptions) {
      await sendEmailAndUpdateStatus(change.after.ref, afterData.email, mailOptions);

      // Send SMS status update if phone exists
      if (afterData.phone) {
        const localizedStatus = newStatus === 'confirmed' ? 'đã được xác nhận' : 'đã bị hủy';
        await smsService.sendSMS(afterData.phone, `Mocha & Miso: Đặt bàn ${afterData.reservationId} ${localizedStatus}.`);
      }
    }
  });
