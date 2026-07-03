'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type ExtendedProject = SerializedProjectWithSnapshot & {
  autores?: string | null
  objetivo?: string | null
  linkProyecto?: string | null
  linkInformes?: string[] | null
};

type DashboardChartsProps = {
  projects: ExtendedProject[]
  compact?: boolean
};

// Blue-based color palette
const RELEVANCE_COLORS = {
  HIGH: '#0f172a', // slate-900
  MEDIUM: '#2563eb', // blue-600
  LOW: '#94a3b8', // slate-400
};

const RELEVANCE_LABELS = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const STAGE_COLORS = [
  '#0f172a', // slate-900
  '#1e40af', // blue-800
  '#2563eb', // blue-600
  '#3b82f6', // blue-500
  '#60a5fa', // blue-400
];

const CHAMBER_COLORS = [
  '#0f172a', // slate-900
  '#2563eb', // blue-600
  '#94a3b8', // slate-400
];

export function DashboardCharts({ projects, compact = false }: DashboardChartsProps) {
  const { data: timelineData } = useQuery({
    queryKey: ['changes-timeline'],
    queryFn: async () => {
      const res = await fetch('/api/legal/changes-timeline');
      if (!res.ok) return { weeks: [] };
      return res.json() as Promise<{ weeks: Array<{ week: string, count: number }> }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const weeksData = useMemo(() => {
    return (timelineData?.weeks ?? []).map((w) => ({
      label: w.week.replace(/^\d{4}-/, ''), // "W05" instead of "2026-W05"
      count: w.count,
    }));
  }, [timelineData]);

  // Data for relevance pie chart
  const relevanceData = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    projects.forEach((p) => {
      if (p.relevance in counts) {
        counts[p.relevance as keyof typeof counts]++;
      }
    });
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: RELEVANCE_LABELS[key as keyof typeof RELEVANCE_LABELS],
        value,
        color: RELEVANCE_COLORS[key as keyof typeof RELEVANCE_COLORS],
      }));
  }, [projects]);

  // Data for stage bar chart (with snapshot fallback)
  const stageData = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    projects.forEach((p) => {
      const stage = p.estado || p.latestSnapshot?.stage || 'Sin estado';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    return Object.entries(stageCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 stages
  }, [projects]);

  // Data for chamber distribution (with snapshot fallback)
  const chamberData = useMemo(() => {
    const chamberCounts: Record<string, number> = {};
    projects.forEach((p) => {
      const chamber = p.camara || p.latestSnapshot?.chamberCurrent || 'Sin cámara';
      chamberCounts[chamber] = (chamberCounts[chamber] || 0) + 1;
    });
    return Object.entries(chamberCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [projects]);

  if (projects.length === 0) {
    return null;
  }

  // Compact mode for sidebar
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Relevance Distribution - Compact */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 mb-2">
            Por Prioridad
          </h4>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={relevanceData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {relevanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                  padding: '6px 10px',
                  fontSize: '12px',
                }}
                formatter={(value, name) => [value, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {relevanceData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-zinc-600 dark:text-zinc-400">
                  {entry.name}
                  {' '}
                  (
                  {entry.value}
                  )
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chamber Distribution - Compact */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 mb-2">
            Por Cámara
          </h4>
          <div className="space-y-2">
            {chamberData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHAMBER_COLORS[index % CHAMBER_COLORS.length] }}
                  />
                  <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Changes Over Time - Compact */}
        {weeksData.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 mb-2">
              Cambios por Semana
            </h4>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={weeksData} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                    padding: '4px 8px',
                    fontSize: '11px',
                  }}
                  formatter={(value) => [value, 'cambios']}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Relevance Pie Chart */}
      <div className="rounded-xl bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:from-zinc-800/50 dark:to-zinc-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <div className="h-2 w-2 rounded-full bg-rose-500" />
          Distribución por Prioridad
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={relevanceData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {relevanceData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '8px 12px',
              }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-3 flex justify-center gap-5 text-xs">
          {relevanceData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {entry.name}
                <span className="ml-1 text-zinc-500">
                  (
                  {entry.value}
                  )
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Bar Chart */}
      <div className="rounded-xl bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:from-zinc-800/50 dark:to-zinc-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
          Proyectos por Estado
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '8px 12px',
              }}
              formatter={(value) => [value, 'Proyectos']}
              cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {stageData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chamber Distribution */}
      <div className="rounded-xl bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:from-zinc-800/50 dark:to-zinc-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
          Proyectos por Cámara
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chamberData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {chamberData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHAMBER_COLORS[index % CHAMBER_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '8px 12px',
              }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs">
          {chamberData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full shadow-sm"
                style={{ backgroundColor: CHAMBER_COLORS[index % CHAMBER_COLORS.length] }}
              />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {entry.name}
                <span className="ml-1 text-zinc-500">
                  (
                  {entry.value}
                  )
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Changes Over Time */}
      {weeksData.length > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:from-zinc-800/50 dark:to-zinc-900">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            Cambios por Semana
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeksData} margin={{ left: 0, right: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} width={24} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                  padding: '8px 12px',
                }}
                formatter={(value) => [value, 'cambios detectados']}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
