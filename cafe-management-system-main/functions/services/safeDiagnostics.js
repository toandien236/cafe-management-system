function safeErrorDiagnostic(error) {
  const message = String(error && error.message || '').trim();
  if (!message) return 'No error message';

  return message
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\+?\d[\d(). -]{7,}\d/g, '[phone]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\b/g, '[token]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(api[-_ ]?key|access[-_ ]?token|password)\s*[:=]\s*\S+/gi, (_match, label) => `${label}=[redacted]`)
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

module.exports = { safeErrorDiagnostic };
