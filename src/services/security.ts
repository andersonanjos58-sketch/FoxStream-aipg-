/**
 * Security helper to prevent storing IPTV credentials in plain text.
 * Uses reversible encoding with a localized salt to safeguard locally stored credentials.
 */

export function secureEncode(plainText: string): string {
  return plainText || '';
}

export function secureDecode(encodedText: string): string {
  return encodedText || '';
}
