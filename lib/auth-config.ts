/**
 * Shared auth configuration constants.
 * This file can be imported by both client and server code.
 */

/**
 * Allowed email domain for signup, e.g. "example.com".
 * Leave unset to allow any email domain.
 */
export const ALLOWED_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? '';
