'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ExternalLink, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Button } from '~/components/ui/button';
import { RelevanceBadge } from './relevance-badge';
import { cn } from '~/lib/utils';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';
import type { ViewMode } from './view-selector';

type SortField = 'boletin' | 'title' | 'relevance' | 'estado' | 'dateIngreso' | 'createdAt';
type SortDirection = 'asc' | 'desc';

type ExtendedProject = SerializedProjectWithSnapshot & {
  autores?: string | null
  objetivo?: string | null
  linkProyecto?: string | null
  linkInformes?: string[] | null
};

type ProjectTableProps = {
  projects: ExtendedProject[]
  onDelete?: (id: number) => void
  viewMode?: ViewMode
};

type SortableHeaderProps = {
  field: SortField
  children: React.ReactNode
  className?: string
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
};

const RELEVANCE_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// Estado a mostrar: manda la última consulta al Senado (snapshot); el campo
// estático `estado` (fijado al crear el proyecto o por seeds) es solo fallback.
// Así todas las filas usan la misma nomenclatura oficial de tramitación.
function displayEstado(project: ExtendedProject): string {
  return project.latestSnapshot?.stage || project.estado || '—';
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField, sortField: SortField, sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
  }
  return sortDirection === 'asc'
    ? <ArrowUp className="ml-1 h-3 w-3" />
    : <ArrowDown className="ml-1 h-3 w-3" />;
}

function SortableHeader({
  field,
  children,
  className,
  sortField,
  sortDirection,
  onSort,
}: SortableHeaderProps) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center hover:text-slate-900 dark:hover:text-slate-100"
      >
        {children}
        <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
      </button>
    </TableHead>
  );
}

export function ProjectTable({ projects, onDelete, viewMode = 'basic' }: ProjectTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleDeleteClick = useCallback((projectId: number) => {
    onDelete?.(projectId);
  }, [onDelete]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'boletin':
          comparison = a.boletin.localeCompare(b.boletin);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'relevance':
          comparison = (RELEVANCE_ORDER[a.relevance as keyof typeof RELEVANCE_ORDER] || 2)
            - (RELEVANCE_ORDER[b.relevance as keyof typeof RELEVANCE_ORDER] || 2);
          break;
        case 'estado':
          comparison = displayEstado(a).localeCompare(displayEstado(b));
          break;
        case 'dateIngreso':
          comparison = (a.dateIngreso || '').localeCompare(b.dateIngreso || '');
          break;
        case 'createdAt':
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [projects, sortField, sortDirection]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <p className="mt-4 text-lg font-medium text-slate-700 dark:text-slate-300">
          No hay proyectos de ley
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Agrega tu primer proyecto para comenzar el seguimiento
        </p>
        <Link href="/legal/projects/new">
          <Button className="mt-6">Agregar Proyecto</Button>
        </Link>
      </div>
    );
  }

  const renderActions = (project: ExtendedProject) => (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/legal/projects/${project.id}`}>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar proyecto">
          <Pencil className="h-4 w-4" />
        </Button>
      </Link>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400"
          onClick={() => handleDeleteClick(project.id)}
          aria-label="Eliminar proyecto"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const renderBoletinCell = (project: ExtendedProject) => (
    <TableCell className="font-mono text-sm">
      <a
        href={`https://www.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${project.boletin}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-cyan-600 hover:underline dark:text-cyan-400"
      >
        {project.boletin}
        <ExternalLink className="h-3 w-3" />
      </a>
    </TableCell>
  );

  const renderTitleCell = (project: ExtendedProject, className?: string) => (
    <TableCell className={className}>
      <div className="flex items-center gap-2">
        <Link
          href={`/legal/projects/${project.id}`}
          className={cn(className?.includes('max-w') ? 'truncate' : 'line-clamp-2', 'hover:underline')}
          title={project.title}
        >
          {project.title}
        </Link>
        {project.hasRecentChanges && (
          <span className="shrink-0 rounded bg-yellow-200 px-1.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
            Nuevo
          </span>
        )}
      </div>
    </TableCell>
  );

  // Render different table layouts based on view mode
  if (viewMode === 'detailed') {
    return (
      <div className="overflow-x-auto rounded-md border dark:border-slate-800">
        <Table aria-label="Tabla de proyectos de ley - Vista detallada">
          <TableHeader>
            <TableRow>
              <SortableHeader field="boletin" className="w-[90px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Boletín</SortableHeader>
              <SortableHeader field="title" className="min-w-[200px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Título</SortableHeader>
              <SortableHeader field="relevance" className="w-[80px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Relevancia</SortableHeader>
              <SortableHeader field="estado" className="w-[100px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Estado</SortableHeader>
              <TableHead className="w-[120px]">Objetivo</TableHead>
              <TableHead className="w-[100px]">Autores</TableHead>
              <TableHead className="w-[100px]">Comisión</TableHead>
              <SortableHeader field="dateIngreso" className="w-[95px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>F. Ingreso</SortableHeader>
              <TableHead className="w-[70px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => {
              const estado = displayEstado(project);
              return (
                <TableRow key={project.id} className={cn(project.hasRecentChanges && 'bg-yellow-50 dark:bg-yellow-950/20')}>
                  {renderBoletinCell(project)}
                  {renderTitleCell(project, 'min-w-[200px]')}
                  <TableCell><RelevanceBadge relevance={project.relevance} /></TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">{estado}</TableCell>
                  <TableCell className="max-w-[120px] text-sm text-slate-600 dark:text-slate-400">
                    <span className="line-clamp-2">{project.objetivo || '—'}</span>
                  </TableCell>
                  <TableCell className="max-w-[100px] text-sm text-slate-600 dark:text-slate-400">
                    <span className="line-clamp-2">{project.autores || '—'}</span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">{project.comision || '—'}</TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">{project.dateIngreso || '—'}</TableCell>
                  <TableCell className="text-right">{renderActions(project)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (viewMode === 'links') {
    return (
      <div className="overflow-x-auto rounded-md border dark:border-slate-800">
        <Table aria-label="Tabla de proyectos de ley - Vista enlaces">
          <TableHeader>
            <TableRow>
              <SortableHeader field="boletin" className="w-[90px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Boletín</SortableHeader>
              <SortableHeader field="title" className="min-w-[200px]" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Título</SortableHeader>
              <TableHead className="w-[120px]">Link Proyecto</TableHead>
              <TableHead className="w-[100px]">Informes</TableHead>
              <TableHead className="w-[150px]">Último Trámite</TableHead>
              <TableHead className="w-[70px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => {
              const lastAction = project.latestSnapshot?.lastAction || '—';
              const lastActionDate = project.latestSnapshot?.lastActionDate || '';
              const informesCount = project.linkInformes?.length || 0;
              return (
                <TableRow key={project.id} className={cn(project.hasRecentChanges && 'bg-yellow-50 dark:bg-yellow-950/20')}>
                  {renderBoletinCell(project)}
                  {renderTitleCell(project, 'min-w-[200px]')}
                  <TableCell>
                    {project.linkProyecto
                      ? (
                          <a
                            href={project.linkProyecto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:underline dark:text-cyan-400"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Ver
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )
                      : <span className="text-sm text-slate-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {informesCount > 0
                      ? (
                          <div className="flex flex-wrap gap-1">
                            {project.linkInformes?.slice(0, 3).map((link, index) => (
                              <a
                                key={link}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-cyan-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-cyan-400"
                              >
                                {index + 1}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ))}
                            {informesCount > 3 && (
                              <span className="text-xs text-slate-500">
                                +
                                {informesCount - 3}
                              </span>
                            )}
                          </div>
                        )
                      : <span className="text-sm text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="line-clamp-2">{lastAction}</span>
                      {lastActionDate && (
                        <span className="mt-0.5 block text-xs text-slate-400">{lastActionDate}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{renderActions(project)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Default: Basic view
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Tabla de proyectos de ley">
        <TableHeader>
          <TableRow className="border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80">
            <SortableHeader field="boletin" className="w-[100px] font-semibold text-slate-700 dark:text-slate-300" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Boletín</SortableHeader>
            <SortableHeader field="title" className="max-w-[280px] font-semibold text-slate-700 dark:text-slate-300" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Título</SortableHeader>
            <SortableHeader field="relevance" className="w-[90px] font-semibold text-slate-700 dark:text-slate-300" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Relevancia</SortableHeader>
            <SortableHeader field="estado" className="w-[120px] font-semibold text-slate-700 dark:text-slate-300" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Estado</SortableHeader>
            <TableHead className="w-[100px] font-semibold text-slate-700 dark:text-slate-300">Cámara</TableHead>
            <TableHead className="w-[110px] font-semibold text-slate-700 dark:text-slate-300">Urgencia</TableHead>
            <TableHead className="w-[90px] text-right font-semibold text-slate-700 dark:text-slate-300">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProjects.map((project) => {
            // Fallback to snapshot data if project fields are empty
            const estado = project.estado || project.latestSnapshot?.stage || '—';
            const camara = project.camara || project.latestSnapshot?.chamberCurrent || '—';
            const urgencia = project.urgencia || project.latestSnapshot?.urgency || '—';
            return (
              <TableRow
                key={project.id}
                className={cn(
                  'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  project.hasRecentChanges && 'bg-amber-50/50 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30',
                )}
              >
                {renderBoletinCell(project)}
                {renderTitleCell(project, 'max-w-[280px]')}
                <TableCell><RelevanceBadge relevance={project.relevance} /></TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-400">{estado}</TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-400">{camara}</TableCell>
                <TableCell className="text-sm text-slate-600 dark:text-slate-400">{urgencia}</TableCell>
                <TableCell className="text-right">{renderActions(project)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
