/**
 * These suites run `prisma db push --accept-data-loss` and `deleteMany`, so
 * they never pick a database themselves: the caller names one it owns.
 * Only an explicit, non-shared loopback port is accepted.
 */
export const SHARED_POOL_PORT = '55433'
export const DEFAULT_POSTGRES_PORT = '5432'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function ownedPostgresUrl(value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      'PARITY_DATABASE_URL is required: name a test-owned Postgres database. These tests drop and rewrite its tables.',
    )
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('PARITY_DATABASE_URL is not a valid URL.')
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('PARITY_DATABASE_URL must be a postgresql:// URL.')
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(
      'PARITY_DATABASE_URL must use a loopback host: localhost, 127.0.0.1, or ::1.',
    )
  }
  if (url.port === '' || url.port === DEFAULT_POSTGRES_PORT) {
    throw new Error(
      `PARITY_DATABASE_URL must use an explicit test-owned port other than ${DEFAULT_POSTGRES_PORT}.`,
    )
  }
  if (url.port === SHARED_POOL_PORT) {
    throw new Error(
      `PARITY_DATABASE_URL uses port ${SHARED_POOL_PORT}, the shared pool port. Start a test-owned Postgres on another port.`,
    )
  }
  return value
}
