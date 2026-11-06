'use client';

import { useRef, useState } from 'react';
import { AiClientError, requestAi, type AiRoute, type ClientFailure } from './client';
import { newCorrelationId } from '../observability/correlation';

export function useAiGeneration(route: AiRoute) {
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClientFailure | null>(null);

  async function generate(payload: unknown): Promise<string | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      return await requestAi(route, payload);
    } catch (failure) {
      setError(failure instanceof AiClientError ? failure : {
        code: 'CLIENT_INVALID_RESPONSE', message: 'AI生成を開始できませんでした。再試行してください。',
        correlationId: newCorrelationId(), retryable: true,
      });
      return null;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return { generate, loading, error };
}
