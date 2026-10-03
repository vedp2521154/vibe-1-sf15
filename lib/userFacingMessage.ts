const technicalDetail = /\b(?:mongo(?:db)?|atlas|database|connection|uri|network access)\b/i;

export function userFacingMessage(message: string, fallback: string): string {
  return technicalDetail.test(message) ? fallback : message;
}
