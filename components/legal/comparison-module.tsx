'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { X, GitCompare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type ComparisonModuleProps = {
  projects: SerializedProjectWithSnapshot[]
};

export function ComparisonModule({ projects }: ComparisonModuleProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedProjects = useMemo(() => {
    return selectedIds
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is SerializedProjectWithSnapshot => p !== undefined);
  }, [selectedIds, projects]);

  const availableProjects = useMemo(() => {
    return projects.filter((p) => !selectedIds.includes(p.id));
  }, [projects, selectedIds]);

  const addProject = (idStr: string) => {
    const id = parseInt(idStr, 10);
    if (!isNaN(id) && selectedIds.length < 3 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const removeProject = (id: number) => {
    setSelectedIds(selectedIds.filter((sid) => sid !== id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  if (projects.length < 2) {
    return (
      <div className="text-center py-4 text-slate-500 dark:text-slate-400">
        <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Necesitas al menos 2 proyectos para comparar</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selector */}
      {selectedIds.length < 3 && (
        <div className="flex gap-2">
          <Select onValueChange={addProject} value="">
            <SelectTrigger className="flex-1 text-xs border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Agregar proyecto..." />
            </SelectTrigger>
            <SelectContent>
              {availableProjects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  <span className="text-xs">
                    {p.boletin}
                    {' '}
                    -
                    {' '}
                    {p.title.slice(0, 30)}
                    ...
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selected projects badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedProjects.map((project) => (
            <span
              key={project.id}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            >
              {project.boletin}
              <button
                type="button"
                onClick={() => removeProject(project.id)}
                className="ml-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedIds.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Comparison Table */}
      {selectedProjects.length >= 2 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left font-medium text-slate-500 dark:text-slate-400">Campo</th>
                {selectedProjects.map((p) => (
                  <th key={p.id} className="py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                    <Link href={`/legal/projects/${p.id}`} className="hover:text-blue-600">
                      {p.boletin}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-2 text-slate-500 dark:text-slate-400">Estado</td>
                {selectedProjects.map((p) => (
                  <td key={p.id} className="py-2 text-slate-700 dark:text-slate-300">
                    {p.estado || p.latestSnapshot?.stage || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-slate-500 dark:text-slate-400">Cámara</td>
                {selectedProjects.map((p) => (
                  <td key={p.id} className="py-2 text-slate-700 dark:text-slate-300">
                    {p.camara || p.latestSnapshot?.chamberCurrent || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-slate-500 dark:text-slate-400">Urgencia</td>
                {selectedProjects.map((p) => {
                  const urgency = p.urgencia || p.latestSnapshot?.urgency || '—';
                  const isUrgent = urgency !== '—' && urgency !== 'Sin urgencia';
                  return (
                    <td key={p.id} className={`py-2 ${isUrgent ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                      {urgency}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2 text-slate-500 dark:text-slate-400">Prioridad</td>
                {selectedProjects.map((p) => (
                  <td key={p.id} className="py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        p.relevance === 'HIGH'
                          ? 'bg-slate-900 text-white dark:bg-slate-800'
                          : p.relevance === 'MEDIUM'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {p.relevance}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-slate-500 dark:text-slate-400">Cambios</td>
                {selectedProjects.map((p) => (
                  <td key={p.id} className="py-2">
                    {p.hasRecentChanges
                      ? (
                          <span className="text-blue-600 dark:text-blue-400">Sí</span>
                        )
                      : (
                          <span className="text-slate-400">No</span>
                        )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {selectedProjects.length < 2 && selectedIds.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Selecciona al menos 2 proyectos para comparar
        </p>
      )}
    </div>
  );
}
