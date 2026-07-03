import type { SerializedProjectWithSnapshot } from './types';

type ExtendedProject = SerializedProjectWithSnapshot & {
  autores?: string | null
  objetivo?: string | null
  linkProyecto?: string | null
  linkInformes?: string[] | null
};

type ExportableProject = {
  boletin: string
  titulo: string
  relevancia: string
  estado: string
  camara: string
  urgencia: string
  comision: string
  fechaIngreso: string
  autores: string
  objetivo: string
  linkProyecto: string
  linkInformes: string
  notas: string
  ultimoTramite: string
  fechaUltimoTramite: string
  createdAt: string
};

/**
 * Transforms project data into a flat structure suitable for export
 */
function transformForExport(projects: ExtendedProject[]): ExportableProject[] {
  return projects.map((p) => ({
    boletin: p.boletin,
    titulo: p.title,
    relevancia: p.relevance === 'HIGH' ? 'Alta' : p.relevance === 'MEDIUM' ? 'Media' : 'Baja',
    estado: p.estado || '',
    camara: p.camara || '',
    urgencia: p.urgencia || '',
    comision: p.comision || '',
    fechaIngreso: p.dateIngreso || '',
    autores: p.autores || '',
    objetivo: p.objetivo || '',
    linkProyecto: p.linkProyecto || '',
    linkInformes: (p.linkInformes || []).join('; '),
    notas: p.notes || '',
    ultimoTramite: p.latestSnapshot?.lastAction || '',
    fechaUltimoTramite: p.latestSnapshot?.lastActionDate || '',
    createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-CL') : '',
  }));
}

/**
 * Export projects to CSV format and trigger download
 */
export function exportToCSV(projects: ExtendedProject[], filename = 'proyectos-legales'): void {
  const data = transformForExport(projects);

  if (data.length === 0) {
    return;
  }

  const headers = [
    'Boletín',
    'Título',
    'Relevancia',
    'Estado',
    'Cámara',
    'Urgencia',
    'Comisión',
    'Fecha Ingreso',
    'Autores',
    'Objetivo',
    'Link Proyecto',
    'Links Informes',
    'Notas',
    'Último Trámite',
    'Fecha Último Trámite',
    'Fecha Creación',
  ];

  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      [
        escapeCSVField(row.boletin),
        escapeCSVField(row.titulo),
        escapeCSVField(row.relevancia),
        escapeCSVField(row.estado),
        escapeCSVField(row.camara),
        escapeCSVField(row.urgencia),
        escapeCSVField(row.comision),
        escapeCSVField(row.fechaIngreso),
        escapeCSVField(row.autores),
        escapeCSVField(row.objetivo),
        escapeCSVField(row.linkProyecto),
        escapeCSVField(row.linkInformes),
        escapeCSVField(row.notas),
        escapeCSVField(row.ultimoTramite),
        escapeCSVField(row.fechaUltimoTramite),
        escapeCSVField(row.createdAt),
      ].join(','),
    ),
  ].join('\n');

  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export projects to Excel-compatible format (tab-separated for better compatibility)
 */
export function exportToExcel(projects: ExtendedProject[], filename = 'proyectos-legales'): void {
  const data = transformForExport(projects);

  if (data.length === 0) {
    return;
  }

  const headers = [
    'Boletín',
    'Título',
    'Relevancia',
    'Estado',
    'Cámara',
    'Urgencia',
    'Comisión',
    'Fecha Ingreso',
    'Autores',
    'Objetivo',
    'Link Proyecto',
    'Links Informes',
    'Notas',
    'Último Trámite',
    'Fecha Último Trámite',
    'Fecha Creación',
  ];

  // Use tab-separated values for Excel
  const tsvContent = [
    headers.join('\t'),
    ...data.map((row) =>
      [
        escapeTSVField(row.boletin),
        escapeTSVField(row.titulo),
        escapeTSVField(row.relevancia),
        escapeTSVField(row.estado),
        escapeTSVField(row.camara),
        escapeTSVField(row.urgencia),
        escapeTSVField(row.comision),
        escapeTSVField(row.fechaIngreso),
        escapeTSVField(row.autores),
        escapeTSVField(row.objetivo),
        escapeTSVField(row.linkProyecto),
        escapeTSVField(row.linkInformes),
        escapeTSVField(row.notas),
        escapeTSVField(row.ultimoTramite),
        escapeTSVField(row.fechaUltimoTramite),
        escapeTSVField(row.createdAt),
      ].join('\t'),
    ),
  ].join('\n');

  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + tsvContent], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  downloadBlob(blob, `${filename}.xls`);
}

/**
 * Escape a field for CSV format
 */
function escapeCSVField(value: string): string {
  if (!value) return '""';
  // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Escape a field for TSV format (Excel)
 */
function escapeTSVField(value: string): string {
  if (!value) return '';
  // Replace tabs and newlines with spaces
  return value.replace(/[\t\n\r]/g, ' ');
}

/**
 * Trigger download of a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
