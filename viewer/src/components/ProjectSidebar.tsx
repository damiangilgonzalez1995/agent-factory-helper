import { useState } from 'react';
import { useProjectList } from '../hooks/useProjectList';
import { formatRelativeTime } from '../lib/formatRelativeTime';

interface Props {
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

export default function ProjectSidebar({ activeSlug, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const projects = useProjectList();

  if (collapsed) {
    return (
      <aside className="project-sidebar collapsed" aria-label="Proyectos">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed(false)}
          title="Mostrar proyectos"
          aria-label="Mostrar proyectos"
        >
          <ProjectsIcon />
        </button>
        {activeSlug && <div className="sidebar-active-dot" title={activeSlug} />}
      </aside>
    );
  }

  return (
    <aside className="project-sidebar" aria-label="Proyectos">
      <header className="sidebar-head">
        <div className="sidebar-head-title">
          <ProjectsIcon />
          <span>Proyectos</span>
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Colapsar"
          aria-label="Colapsar panel de proyectos"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
      </header>

      <div className="sidebar-list">
        {projects.map((p) => (
          <div
            key={p.slug}
            className={`sidebar-project${p.slug === activeSlug ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(p.slug)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(p.slug);
              }
            }}
            aria-current={p.slug === activeSlug ? 'page' : undefined}
          >
            <span className={`sidebar-dot${p.slug === activeSlug ? ' active' : ''}`} />
            <div className="sidebar-project-info">
              <div className="sidebar-project-name">{p.slug}</div>
              <div className="sidebar-project-title">{p.title}</div>
              <div className="sidebar-project-meta">
                <span>{p.agentCount} ag · {p.toolCount} tools</span>
                <span>{formatRelativeTime(p.mtime)}</span>
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="sidebar-empty">No hay proyectos en <code>architectures/</code></p>
        )}
      </div>

      <footer className="sidebar-foot">
        Crea un caso con <code>case-intake</code> en Claude Code.
      </footer>
    </aside>
  );
}

function ProjectsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
