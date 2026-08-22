import type { SseWritable } from './sse'

/**
 * NDJSON chunked streaming for list reads.
 *
 * Contract: one JSON document per line; the final line is
 * `{"done":true,"rows":N}`. Clients parse by splitting on newlines — there is
 * no event vocabulary and no client-side merge algorithm. The same guard
 * shapes, projection defaults, and pagination limits apply as on the JSON
 * endpoint, because every page goes through the same generated core function.
 */

export function acceptsNdjson(accept: string | undefined): boolean {
  if (!accept) return false
  return accept
    .toLowerCase()
    .split(',')
    .some((entry) => entry.split(';')[0].trim() === 'application/x-ndjson')
}

export function startNdjson(res: SseWritable): void {
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Stream-Protocol-Version', '1')
  res.setHeader('X-Accel-Buffering', 'no')
  res.statusCode = 200
}

export interface NdjsonStreamOptions {
  res: SseWritable
  isClosed: () => boolean
  fetchPage: (skip: number, take: number) => Promise<unknown>
  initialSkip: number
  requestedTake?: number
  defaultLimit?: number
  maxLimit: number
}

export async function runNdjsonFindMany(
  options: NdjsonStreamOptions,
): Promise<void> {
  startNdjson(options.res)
  const take = Math.min(
    options.requestedTake ?? options.defaultLimit ?? options.maxLimit,
    options.maxLimit,
  )
  let skip = options.initialSkip
  let written = 0

  while (
    written < options.maxLimit &&
    !options.isClosed() &&
    !options.res.writableEnded
  ) {
    const result = await options.fetchPage(skip, take)
    if (!Array.isArray(result)) {
      throw new Error(
        'NDJSON streaming requires an array result from the core read',
      )
    }
    for (const row of result) {
      if (written >= options.maxLimit) break
      options.res.write(JSON.stringify(row) + '\n')
      written++
    }
    if (result.length < take) break
    skip += result.length
  }

  options.res.write(JSON.stringify({ done: true, rows: written }) + '\n')
  options.res.end()
}
