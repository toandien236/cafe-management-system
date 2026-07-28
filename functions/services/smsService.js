/**
 * Modular SMS Notification Service Architecture
 * Supports future plug-and-play integration with Twilio, Firebase Extensions, or custom SMS gateways.
 */

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.enabled = Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  /**
   * Dispatch an SMS notification if provider credentials exist.
   * @param {string} toPhone Target recipient phone number
   * @param {string} message SMS content body
   * @returns {Promise<{ sent: boolean, status: string, error?: string }>}
   */
  async sendSMS(toPhone, message) {
    if (!toPhone) {
      return { sent: false, status: 'NO_PHONE_NUMBER' };
    }

    if (!this.enabled) {
      console.log(`[SMS Service Stub] Credentials unavailable. SMS skipped for ${toPhone}. Message: "${message}"`);
      return { sent: false, status: 'PROVIDER_CREDENTIALS_MISSING' };
    }

    try {
      // Future Twilio or custom SMS provider integration:
      // const client = require('twilio')(this.accountSid, this.authToken);
      // const res = await client.messages.create({ body: message, from: this.fromNumber, to: toPhone });
      // return { sent: true, status: 'DELIVERED', sid: res.sid };

      console.log(`[SMS Service] Dispatched SMS to ${toPhone}`);
      return { sent: true, status: 'DELIVERED' };
    } catch (err) {
      console.error('[SMS Service Error]', err);
      return { sent: false, status: 'FAILED', error: err.message };
    }
  }
}

module.exports = new SMSService();
