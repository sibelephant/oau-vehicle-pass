export type DatabaseConfig = {
  DATABASE_URL: string;
};

export function withSslMode(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}
