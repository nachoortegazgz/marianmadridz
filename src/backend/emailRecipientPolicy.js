import { SDK_CONFIG } from "backend/internalConfig";

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function isAllowedEmailRecipient(value) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) return false;
  const email = value.toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return false;

  const exactEmails = SDK_CONFIG.EMAIL.ALLOWED_RECIPIENT_EMAILS || [];
  const allowedDomains = SDK_CONFIG.EMAIL.ALLOWED_RECIPIENT_DOMAINS || [];
  if (exactEmails.some((candidate) => email === String(candidate).toLowerCase())) return true;

  const separator = email.lastIndexOf("@");
  const domain = email.slice(separator + 1);
  return allowedDomains.some((candidate) => domain === String(candidate).toLowerCase());
}

export function areAllowedEmailRecipients(value) {
  const recipients = Array.isArray(value) ? value : [value];
  return recipients.length > 0 && recipients.every(isAllowedEmailRecipient);
}
