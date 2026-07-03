'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity, BarChart3, Calendar, Bell, GitCompare, Download } from 'lucide-react';

type SidebarModuleProps = {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: number
};

function SidebarModule({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
  badge,
}: SidebarModuleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {title}
              </span>
              {badge !== undefined && badge > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {description}
            </p>
          </div>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          {isOpen
            ? (
                <ChevronUp className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )
            : (
                <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

export type DashboardSidebarProps = {
  activityFeedContent: React.ReactNode
  chartsContent: React.ReactNode
  calendarContent: React.ReactNode
  alertsContent: React.ReactNode
  comparisonContent: React.ReactNode
  exportContent: React.ReactNode
  changesCount?: number
  alertsCount?: number
};

export function DashboardSidebar({
  activityFeedContent,
  chartsContent,
  calendarContent,
  alertsContent,
  comparisonContent,
  exportContent,
  changesCount = 0,
  alertsCount = 0,
}: DashboardSidebarProps) {
  return (
    <aside className="space-y-3">
      {/* Alertas */}
      <SidebarModule
        title="Alertas"
        description="Requieren atención"
        icon={<Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
        badge={alertsCount}
        defaultOpen={alertsCount > 0}
      >
        {alertsContent}
      </SidebarModule>

      {/* Calendario */}
      <SidebarModule
        title="Calendario"
        description="Plazos y urgencias"
        icon={<Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
      >
        {calendarContent}
      </SidebarModule>

      {/* Actividad Reciente */}
      <SidebarModule
        title="Actividad Reciente"
        description="Últimos cambios"
        icon={<Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
        badge={changesCount}
      >
        {activityFeedContent}
      </SidebarModule>

      {/* Estadísticas */}
      <SidebarModule
        title="Estadísticas"
        description="Distribución visual"
        icon={<BarChart3 className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
      >
        {chartsContent}
      </SidebarModule>

      {/* Comparador */}
      <SidebarModule
        title="Comparador"
        description="Comparar proyectos"
        icon={<GitCompare className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
      >
        {comparisonContent}
      </SidebarModule>

      {/* Exportación */}
      <SidebarModule
        title="Exportación"
        description="Descargar datos"
        icon={<Download className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
      >
        {exportContent}
      </SidebarModule>
    </aside>
  );
}
