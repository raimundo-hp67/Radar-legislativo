'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';

type SearchBarProps = {
  onSearch: (query: string) => void
  placeholder?: string
};

export function SearchBar({ onSearch, placeholder = 'Buscar proyectos...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const clearSearch = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className={`relative flex items-center rounded-lg border bg-white transition-all dark:bg-zinc-800 ${
      isFocused
        ? 'border-indigo-400 ring-2 ring-indigo-100 dark:border-indigo-500 dark:ring-indigo-900'
        : 'border-zinc-200 dark:border-zinc-700'
    }`}
    >
      <Search className="ml-3 h-4 w-4 shrink-0 text-zinc-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="h-10 w-full bg-transparent px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
        aria-label="Buscar proyectos"
      />
      {query && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clearSearch}
          className="mr-1 h-7 w-7 shrink-0 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
