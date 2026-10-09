export function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value);
}
