/**
 * ANON Local Privacy Guard
 *
 * Runs in the browser only. Do not send findings or scanned text to telemetry,
 * analytics, the server, or an AI provider.
 */
const RULES: Array<{ label: string; test: RegExp }> = [
  { label: "Email address", test: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "Indian mobile number", test: /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/ },
  { label: "Possible Aadhaar / 12-digit ID", test: /\b(?:Aadhaar|Aadhar)(?:\s*(?:no|number|#))?\s*[:=-]?\s*(?:\d[ -]?){11}\d\b/i },
  { label: "Possible 12-digit ID number", test: /(?<!\d)(?:\d[ -]?){11}\d(?!\d)/ },
  { label: "PAN / tax ID", test: /\b[A-Z]{5}\d{4}[A-Z]\b/i },
  { label: "UPI / payment ID", test: /\b(?:upi|payment\s*id|pay\s*to)\s*[:=-]?\s*[\w.-]{2,}@[\w.-]{2,}\b/i },
  { label: "Password, PIN or OTP", test: /\b(?:otp|one[- ]time password|password|passcode|verification code|pin)\s*(?:is|:|=)\s*\S{4,}/i },
  { label: "Possible home address", test: /\b(?:my home address|my address|home address)\s*(?:is|:|=)\s*[^\n,]{5,}(?:,\s*[^\n,]{2,}){1,3}/i },
];

export function inspectSensitiveText(text: string): string[] {
  if (!text) return [];
  return RULES.filter((rule) => rule.test.test(text)).map((rule) => rule.label);
}

/**
 * Creates a local suggested redaction. This does not send or save the source text.
 * The caller should let the user review the edited message before sending it.
 */
export function redactSensitiveText(text: string): string {
  let result = text;
  result = result.replace(
    /\b((?:otp|one[- ]time password|password|passcode|verification code|pin)\s*(?:is|:|=)\s*)\S{4,}/gi,
    "$1[hidden]"
  );
  result = result.replace(
    /\b(?:upi|payment\s*id|pay\s*to)\s*[:=-]?\s*[\w.-]{2,}@[\w.-]{2,}\b/gi,
    "[payment ID removed]"
  );
  result = result.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]");
  result = result.replace(/\b(?:Aadhaar|Aadhar)(?:\s*(?:no|number|#))?\s*[:=-]?\s*(?:\d[ -]?){11}\d\b/gi, "[ID number removed]");
  result = result.replace(/(?<!\d)(?:\d[ -]?){11}\d(?!\d)/g, "[12-digit number removed]");
  result = result.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[tax ID removed]");
  result = result.replace(/(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g, "[phone number removed]");
  result = result.replace(
    /\b((?:my home address|my address|home address)\s*(?:is|:|=)\s*)[^\n]+/gi,
    "$1[address removed]"
  );
  return result;
}
