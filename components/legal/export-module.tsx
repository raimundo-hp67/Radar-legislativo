'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileJson, FileText, Download, Check } from 'lucide-react';
import { Button } from '~/components/ui/button';
import * as XLSX from 'xlsx';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type ExportModuleProps = {
  projects: SerializedProjectWithSnapshot[]
};

type ExportFormat = 'csv' | 'excel' | 'json';

export function ExportModule({ projects }: ExportModuleProps) {
  const [lastExported, setLastExported] = useState<ExportFormat | null>(null);

  const prepareData = () => {
    return projects.map((p) => ({
      Boletín: p.boletin,
      Título: p.title,
      Estado: p.estado || p.latestSnapshot?.stage || '',
      Cámara: p.camara || p.latestSnapshot?.chamberCurrent || '',
      Comisión: p.comision || p.latestSnapshot?.commission || '',
      Urgencia: p.urgencia || p.latestSnapshot?.urgency || '',
      Prioridad: p.relevance,
      'Fecha Ingreso': p.dateIngreso || '',
      'Última Acción': p.latestSnapshot?.lastAction || '',
      'Fecha Última Acción': p.latestSnapshot?.lastActionDate || '',
      'Con Cambios': p.hasRecentChanges ? 'Sí' : 'No',
      Notas: p.notes || '',
    }));
  };

  const exportCSV = () => {
    const data = prepareData();
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const value = String(row[h as keyof typeof row] || '');
          // Escape quotes and wrap in quotes if contains comma
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(','),
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `proyectos-legales-${formatDate()}.csv`);
    setLastExported('csv');
    setTimeout(() => setLastExported(null), 2000);
  };

  const exportExcel = () => {
    const data = prepareData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proyectos');

    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...data.map((row) => String(row[key as keyof typeof row] || '').length),
      ),
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `proyectos-legales-${formatDate()}.xlsx`);
    setLastExported('excel');
    setTimeout(() => setLastExported(null), 2000);
  };

  const exportJSON = () => {
    const data = projects.map((p) => ({
      id: p.id,
      boletin: p.boletin,
      title: p.title,
      relevance: p.relevance,
      estado: p.estado || p.latestSnapshot?.stage || null,
      camara: p.camara || p.latestSnapshot?.chamberCurrent || null,
      comision: p.comision || p.latestSnapshot?.commission || null,
      urgencia: p.urgencia || p.latestSnapshot?.urgency || null,
      dateIngreso: p.dateIngreso,
      latestSnapshot: p.latestSnapshot,
      hasRecentChanges: p.hasRecentChanges,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    downloadBlob(blob, `proyectos-legales-${formatDate()}.json`);
    setLastExported('json');
    setTimeout(() => setLastExported(null), 2000);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 dark:text-slate-400">
        <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay proyectos para exportar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {projects.length}
        {' '}
        proyecto
        {projects.length !== 1 ? 's' : ''}
        {' '}
        disponible
        {projects.length !== 1 ? 's' : ''}
      </p>

      {/* CSV */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={exportCSV}
      >
        <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="flex-1 text-left">Exportar CSV</span>
        {lastExported === 'csv' && <Check className="h-4 w-4 text-blue-600" />}
      </Button>

      {/* Excel */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={exportExcel}
      >
        <FileSpreadsheet className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="flex-1 text-left">Exportar Excel</span>
        {lastExported === 'excel' && <Check className="h-4 w-4 text-blue-600" />}
      </Button>

      {/* JSON */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={exportJSON}
      >
        <FileJson className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="flex-1 text-left">Exportar JSON</span>
        {lastExported === 'json' && <Check className="h-4 w-4 text-blue-600" />}
      </Button>
    </div>
  );
}
