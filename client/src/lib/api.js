import { ORDER_STATUSES } from './orderStatus.js';

export class ApiError extends Error {
  constructor(message, status, retryAfter = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach Hash Food. Check your connection and try again.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};
  if (!response.ok) {
    const message = response.status === 429
      ? payload.error || 'Too many attempts. Please wait a little and try again.'
      : payload.error || 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status, Number(response.headers.get('retry-after')) || 0);
  }
  return payload;
}

export const jsonBody = (value) => JSON.stringify(value);
export { ORDER_STATUSES };

export function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-PK')}`;
}

export const PHONE_PATTERN = /^[+0-9][0-9\s-]{8,17}$/;

export function validateOrder(values, cart) {
  const errors = {};
  if (values.customerName.trim().length < 2) errors.customerName = 'Enter your name (at least 2 characters).';
  if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = 'Enter a valid phone number.';
  if (values.orderType === 'Delivery' && values.address.trim().length < 5) errors.address = 'Enter a delivery address (at least 5 characters).';
  if (!cart.length || cart.length > 30 || cart.some((item) => !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20)) {
    errors.cart = 'Your cart has an invalid number of items or quantities.';
  }
  return errors;
}
