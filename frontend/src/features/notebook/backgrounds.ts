import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { PageBackground } from '../../api/types';
import { PAGE_HEIGHT, PAGE_WIDTH } from './ink/constants';

/**
 * Page background images (imported PDF pages).
 * They need the auth header, so they are fetched as blobs and shown via object URLs,
 * cached for the lifetime of the tab.
 */
const blobs = new Map<string, Promise<Blob>>();
const urls = new Map<string, string>();

export function loadBackgroundBlob(pageId: string): Promise<Blob> {
  let blob = blobs.get(pageId);
  if (!blob) {
    blob = api.getPageBackground(pageId);
    blob.catch(() => blobs.delete(pageId)); // allow a retry after a failed download
    blobs.set(pageId, blob);
  }
  return blob;
}

/** Registers an image we already have (right after import), so it isn't downloaded again. */
export function primeBackground(pageId: string, blob: Blob) {
  blobs.set(pageId, Promise.resolve(blob));
}

async function backgroundUrl(pageId: string): Promise<string> {
  const cached = urls.get(pageId);
  if (cached) return cached;
  const url = URL.createObjectURL(await loadBackgroundBlob(pageId));
  urls.set(pageId, url);
  return url;
}

/** Object URL of a page's background once loaded (only fetched while `enabled`). */
export function useBackgroundUrl(pageId: string, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(() => urls.get(pageId) ?? null);
  useEffect(() => {
    if (!enabled || url) return;
    let cancelled = false;
    backgroundUrl(pageId).then(
      (u) => !cancelled && setUrl(u),
      () => {}, // stays blank; the ink is still usable
    );
    return () => {
      cancelled = true;
    };
  }, [pageId, enabled, url]);
  return url;
}

/**
 * Where a background sits on the page (page units): scaled to fit, centred horizontally,
 * aligned to the top — so a landscape slide leaves room for notes underneath.
 */
export function backgroundRect(bg: PageBackground) {
  const scale = Math.min(PAGE_WIDTH / bg.width, PAGE_HEIGHT / bg.height);
  const width = bg.width * scale;
  const height = bg.height * scale;
  return { x: (PAGE_WIDTH - width) / 2, y: 0, width, height };
}
