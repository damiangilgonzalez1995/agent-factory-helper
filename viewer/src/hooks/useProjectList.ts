import { useCallback, useEffect, useState } from 'react';

export interface ProjectEntry {
  slug: string;
  mtime: number;
  title: string;
  agentCount: number;
  toolCount: number;
}

export function useProjectList(): ProjectEntry[] {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/cases');
      if (!res.ok) return;
      const data = (await res.json()) as ProjectEntry[];
      setProjects(data);
    } catch {
      // silencioso: sidebar simplemente queda vacío
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => void fetchProjects();
    import.meta.hot.on('architecture-changed', handler);
    return () => import.meta.hot?.off('architecture-changed', handler);
  }, [fetchProjects]);

  return projects;
}
