'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

type PaginationProps = {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
};

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row">
      {/* Items info */}
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {totalItems === 0
          ? (
              'Sin resultados'
            )
          : (
              <>
                Mostrando
                {' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{startItem}</span>
                {' '}
                a
                {' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{endItem}</span>
                {' '}
                de
                {' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalItems}</span>
                {' '}
                proyectos
              </>
            )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Por página
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              onPageSizeChange(Number(value));
              onPageChange(1); // Reset to first page when changing page size
            }}
          >
            <SelectTrigger className="w-[70px] border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
              <SelectItem value={totalItems.toString()}>Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canGoPrevious}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-white">{currentPage}</span>
                {' / '}
                <span className="text-zinc-500 dark:text-zinc-400">{totalPages}</span>
              </span>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canGoNext}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
