export function isTransientApiTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Parse Error: Missing expected CR after response line|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ERR_HTTP2_PROTOCOL_ERROR/i.test(
    message,
  );
}

export async function retryTransientApiRequest<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientApiTransportError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
