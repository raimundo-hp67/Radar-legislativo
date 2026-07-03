'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { LayoutGrid, List, Link2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';

export type ViewMode = 'basic' | 'detailed' | 'links';

type ViewSelectorProps = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
};

const VIEW_STORAGE_KEY = 'legal-dashboard-view';

const viewOptions: { value: ViewMode, label: string, description: string, icon: React.ReactNode }[] = [
  {
    value: 'basic',
    label: 'Básica',
    description: 'Boletín, Título, Relevancia, Estado, Cámara, Urgencia',
    icon: <LayoutGrid className="h-4 w-4" />,
  },
  {
    value: 'detailed',
    label: 'Detallada',
    description: 'Incluye Objetivo, Autores, Comisión, Fecha Ingreso',
    icon: <List className="h-4 w-4" />,
  },
  {
    value: 'links',
    label: 'Enlaces',
    description: 'Boletín, Título, Links Proyecto, Informes, Último Trámite',
    icon: <Link2 className="h-4 w-4" />,
  },
];

export function ViewSelector({ value, onChange }: ViewSelectorProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          if (newValue) {
            onChange(newValue as ViewMode);
          }
        }}
        className="justify-start"
      >
        {viewOptions.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={option.value}
                aria-label={option.label}
                className="gap-1.5 px-3"
              >
                {option.icon}
                <span className="hidden sm:inline">{option.label}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="font-medium">{option.label}</p>
              <p className="text-xs text-stone-400">{option.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

// Helper to read from localStorage on client
function getStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'basic';
  const stored = localStorage.getItem(VIEW_STORAGE_KEY);
  if (stored && ['basic', 'detailed', 'links'].includes(stored)) {
    return stored as ViewMode;
  }
  return 'basic';
}

// Subscribe to storage changes (for cross-tab sync)
function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

// Server snapshot always returns 'basic'
function getServerSnapshot(): ViewMode {
  return 'basic';
}

/**
 * Hook to persist view preference in localStorage
 * Uses useSyncExternalStore to avoid hydration mismatches
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  // Use useSyncExternalStore to read from localStorage safely
  const storedValue = useSyncExternalStore(
    subscribeToStorage,
    getStoredViewMode,
    getServerSnapshot,
  );

  // Local state that syncs with localStorage
  const [viewMode, setViewModeState] = useState<ViewMode>(storedValue);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    }
  }, []);

  // Return the synced value (prefer localStorage on client)
  return [typeof window !== 'undefined' ? storedValue : viewMode, setViewMode];
}
