export class BodyReadError extends Error {
  status: number;
  constructor(status: number) {
    super('Invalid JSON request');
    this.status = status;
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new BodyReadError(415);
  if (Number(request.headers.get('content-length')) > maxBytes) throw new BodyReadError(413);
  if (!request.body) throw new BodyReadError(400);
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BodyReadError(413);
      }
      chunks.push(value);
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(buffer)); }
    catch { throw new BodyReadError(400); }
  } finally {
    reader.releaseLock();
  }
}
