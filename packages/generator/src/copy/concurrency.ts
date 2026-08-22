export async function mapLimited<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  let index = 0
  const workerCount = Math.min(limit, items.length)
  const workers: Promise<void>[] = []
  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        for (;;) {
          const i = index++
          if (i >= items.length) return
          await fn(items[i], i)
        }
      })(),
    )
  }
  await Promise.all(workers)
}
