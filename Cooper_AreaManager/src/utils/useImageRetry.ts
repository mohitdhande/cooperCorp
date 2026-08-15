import { useCallback, useState } from 'react';

const MAX_RETRIES = 2;

// A profilePic URL can fail to load once and succeed moments later (a flaky
// CDN response, or — as with one real account whose stored URL is missing
// its file extension — a response some requests content-sniff correctly
// and others don't). Retries a failed URL up to MAX_RETRIES times before
// finally falling back to initials, instead of giving up on the first
// error the way a plain onError->initials fallback does.
export function useImageRetry() {
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  // React Native's <Image> won't re-attempt a URL that already failed on
  // its own — changing the element's key forces a fresh native Image
  // instance, which does try loading again.
  const getKey = useCallback((url: string) => `${url}:${attempts[url] || 0}`, [attempts]);

  const handleError = useCallback((url: string | null | undefined) => {
    if (!url) return;
    setAttempts((prev) => {
      const next = (prev[url] || 0) + 1;
      if (next > MAX_RETRIES) {
        setFailed((f) => ({ ...f, [url]: true }));
        return prev;
      }
      return { ...prev, [url]: next };
    });
  }, []);

  const hasFailed = useCallback((url: string | null | undefined) => !!(url && failed[url]), [failed]);

  return { getKey, handleError, hasFailed };
}
