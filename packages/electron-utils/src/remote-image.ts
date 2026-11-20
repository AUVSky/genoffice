/** Cap for a single downloaded picture; the model can point any insert path at an arbitrary URL. */
export const MAX_REMOTE_IMAGE_BYTES = 50 * 1024 * 1024

export class ResponseTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`response larger than ${Math.round(maxBytes / (1024 * 1024))} MB`)
  }
}

function declaredLength(resp: Response): number | undefined {
  const raw = resp.headers.get('content-length')
  if (raw === null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Body bytes of `resp`, capped at `maxBytes`. A Content-Length above the cap
 * is refused before reading; otherwise (chunked transfers carry none, and a
 * header can lie) the stream is counted as it arrives and cancelled the moment
 * the cap is passed, so an oversized body never sits in memory whole.
 */
export async function readBodyCapped(resp: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = declaredLength(resp)
  if (declared !== undefined && declared > maxBytes) {
    await resp.body?.cancel().catch(() => {})
    throw new ResponseTooLargeError(maxBytes)
  }
  if (!resp.body) {
    const bytes = new Uint8Array(await resp.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw new ResponseTooLargeError(maxBytes)
    return bytes
  }
  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new ResponseTooLargeError(maxBytes)
    }
    chunks.push(value)
  }
  if (chunks.length === 1) return chunks[0]!
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
