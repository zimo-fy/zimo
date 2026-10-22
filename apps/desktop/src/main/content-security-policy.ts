export function buildContentSecurityPolicy(isDevelopment: boolean): string {
  const scriptSource = isDevelopment ? "'self' 'unsafe-inline'" : "'self'";
  const connectSource = isDevelopment ? "'self' ws: http://localhost:*" : "'self'";

  return `default-src 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: zimo-doc:; font-src 'self'; connect-src ${connectSource}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`;
}
