'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';

type SearchBarProps = {
  onSearch: (query: string) => void
  placeholder?: string
};

export function SearchBar({ onSearch, placeholder = 'Buscar proyectos...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Keep the latest callback in a ref: parents often recreate onSearch on
  // every render, and having it as an effect dependency re-fired the debounce
  // (calling onSearch with a stale/empty query) on unrelated re-renders —
  // e.g. resetting the table to page 1 right after changing page.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Debounce search: fire only when the typed query actually changes.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onSearchRef.current(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const clearSearch = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className={`relative flex items-center rounded-lg border bg-white transition-all dark:bg-slate-800 ${
      isFocused
        ? 'border-cyan-400 ring-2 ring-cyan-100 dark:border-cyan-500 dark:ring-cyan-900'
        : 'border-slate-200 dark:border-slate-700'
    }`}
    >
      <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="h-10 w-full bg-transparent px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100"
        aria-label="Buscar proyectos"
      />
      {query && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clearSearch}
          className="mr-1 h-7 w-7 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
