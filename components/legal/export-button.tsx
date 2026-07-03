'use client';

import { Download } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { exportToCSV, exportToExcel } from '~/lib/legal/export';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type ExtendedProject = SerializedProjectWithSnapshot & {
  autores?: string | null
  objetivo?: string | null
  linkProyecto?: string | null
  linkInformes?: string[] | null
};

type ExportButtonProps = {
  projects: ExtendedProject[]
  disabled?: boolean
};

export function ExportButton({ projects, disabled }: ExportButtonProps) {
  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(projects, `proyectos-legales-${dateStr}`);
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(projects, `proyectos-legales-${dateStr}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || projects.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          Exportar a CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel}>
          Exportar a Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
