import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { WorkspaceSidebar } from "./workspace-sidebar";

export function AdminShell({ activePath, title, subtitle, children }: { activePath: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="app-shell dashboard-theme">
      <div className="app-body">
        <WorkspaceSidebar activePath={activePath} />
        <section className="main">
          <header className="topbar">
            <div><h1 className="topbar-title">{title}</h1>{subtitle && <p className="topbar-subtitle">{subtitle}</p>}</div>
            <div className="topbar-tools">
              <button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button>
              <div className="topbar-profile">YB</div>
            </div>
          </header>
          <div className="page-content admin-shell-content">{children}</div>
        </section>
      </div>
    </main>
  );
}
