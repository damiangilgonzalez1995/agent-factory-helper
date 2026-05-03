import { useCallback, useEffect, useState } from 'react';
import type { Architecture, VariantKey } from '../types';

interface UseArchFileResult {
  arch: Architecture | null;
  slug: string | null;
  error: string | null;
  reload: () => void;
  saveLayout: (positions: Map<string, { x: number; y: number }>, summary?: string) => Promise<void>;
  navigateTo: (newSlug: string) => void;
}

/**
 * Loads architectures/<slug>.json via the Vite plugin endpoint.
 * Listens for HMR-broadcast file changes and refetches.
 * Supports persisting node positions back to the JSON.
 */
export function useArchitectureFile(initialSlug: string | null): UseArchFileResult {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [arch, setArch] = useState<Architecture | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchArch = useCallback(async (target: string) => {
    try {
      const res = await fetch(`/api/architecture/${target}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Architecture;
      setArch(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setArch(null);
    }
  }, []);

  const resolveSlug = useCallback(async () => {
    if (slug) return slug;
    try {
      const res = await fetch('/api/cases');
      const cases = (await res.json()) as Array<{ slug: string; mtime: number }>;
      if (cases.length === 0) {
        setError(
          'No hay casos en architectures/. Crea uno con los subagentes (case-intake) o copia el ejemplo.',
        );
        return null;
      }
      const newest = cases[0].slug;
      setSlug(newest);
      return newest;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [slug]);

  useEffect(() => {
    (async () => {
      const target = slug ?? (await resolveSlug());
      if (target) await fetchArch(target);
    })();
  }, [slug, resolveSlug, fetchArch]);

  // Hot reload via Vite HMR custom event
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = (data: { slug: string }) => {
      if (slug && data.slug === slug) {
        fetchArch(slug);
      }
    };
    import.meta.hot.on('architecture-changed', handler);
    return () => {
      import.meta.hot?.off('architecture-changed', handler);
    };
  }, [slug, fetchArch]);

  const reload = useCallback(() => {
    if (slug) fetchArch(slug);
  }, [slug, fetchArch]);

  const saveLayout = useCallback(
    async (positions: Map<string, { x: number; y: number }>, summary?: string) => {
      if (!arch || !slug) return;
      const updated = structuredClone(arch);
      const variantKeys: VariantKey[] = ['basic', 'intermediate', 'advanced'];
      const target = updated.variants[updated.activeVariant];
      const collections = [target.agents, target.tools, target.bridges, target.dataStores];
      for (const coll of collections) {
        for (const item of coll) {
          const pos = positions.get(item.id);
          if (pos) item.position = pos;
        }
      }
      // Capture history
      updated.history.push({
        timestamp: new Date().toISOString(),
        variant: updated.activeVariant,
        summary: summary ?? 'Layout actualizado desde el viewer (drag & drop).',
        snapshot: Object.fromEntries(
          variantKeys.map((k) => [k, structuredClone(updated.variants[k])]),
        ) as Record<VariantKey, typeof target>,
      });

      const res = await fetch(`/api/architecture/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setArch(updated);
    },
    [arch, slug],
  );

  return { arch, slug, error, reload, saveLayout, navigateTo: setSlug };
}
