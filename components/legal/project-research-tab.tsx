'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Send,
  Bot,
  User,
  RefreshCw,
  Sparkles,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface SearchResultItem {
  boletin: string
  titulo: string
  fechaIngreso: string | null
  estado: string | null
  camara: string | null
  autores: string | null
  materia: string | null
  resumen: string | null
  source: string
  url: string
}

const SUGGESTED_QUESTIONS = [
  '¿Qué proyectos de fintech están en trámite?',
  '¿Cuál es el estado del proyecto sobre open banking?',
  '¿Qué proyectos de alta prioridad estamos monitoreando?',
  '¿Qué cambios recientes han tenido nuestros proyectos?',
  '¿Hay proyectos sobre protección de datos financieros?',
];

const QUICK_KEYWORDS = [
  'fintech',
  'open banking',
  'pagos electrónicos',
  'ciberseguridad',
  'protección de datos',
  'CMF',
  'criptomonedas',
  'inteligencia artificial',
];

// ─── Inline markdown renderer ────────────────────────────────────────────────

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Bullet list items
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*•]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1 list-disc space-y-0.5 pl-4">
          {items.map((item, j) => (
            <li key={j}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\.\s+/, ''));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-1 list-decimal space-y-0.5 pl-4">
          {items.map((item, j) => (
            <li key={j}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Empty line → small gap
    if (!line.trim()) {
      nodes.push(<div key={`sp-${i}`} className="h-1" />);
      i++;
      continue;
    }

    // Regular paragraph line
    nodes.push(
      <p key={`p-${i}`} className="leading-relaxed">
        <InlineText text={line} />
      </p>,
    );
    i++;
  }

  return <div className="space-y-0.5 text-sm">{nodes}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectResearchTab() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);

    try {
      const keywords = query.split(/[,\s]+/).filter(Boolean).join(',');
      const res = await fetch(`/api/legal/search?q=${encodeURIComponent(keywords)}`);
      const data = await res.json();
      setSearchResults(res.ok ? (data.results ?? []) : []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    doSearch(searchQuery);
  }, [searchQuery, doSearch]);

  const handleKeywordClick = useCallback((keyword: string) => {
    setSearchQuery(keyword);
    doSearch(keyword);
  }, [doSearch]);

  const askAboutProject = useCallback((result: SearchResultItem) => {
    setChatInput(`Cuéntame sobre el proyecto ${result.boletin}: "${result.titulo}"`);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isChatLoading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    // Capture history BEFORE any state updates (closures are stable here)
    const historySnapshot = messages
      .filter((m) => !m.streaming)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      userMessage,
      { role: 'assistant', content: '', streaming: true },
    ]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/legal/projects/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: historySnapshot,
          moduleKey: 'investigacion',
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        const msg = response.status === 429
          ? (data.error ?? 'Límite de solicitudes alcanzado. Espera unos segundos.')
          : (data.error ?? 'Error al comunicarse con el agente');
        throw new Error(msg);
      }

      if (!response.body) throw new Error('Sin respuesta del servidor');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const chunk = JSON.parse(data) as string;
            fullContent += chunk;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.role === 'assistant') {
                updated[lastIdx] = { role: 'assistant', content: fullContent, streaming: true };
              }
              return updated;
            });
          } catch {
            // ignore partial JSON chunks
          }
        }
      }

      // Mark streaming as complete
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            role: 'assistant',
            content: fullContent || 'No se pudo generar una respuesta.',
          };
        }
        return updated;
      });
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : 'No se pudo conectar con el agente.';

      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant' && updated[lastIdx].streaming) {
          updated[lastIdx] = { role: 'assistant', content: errorMsg };
        } else {
          updated.push({ role: 'assistant', content: errorMsg });
        }
        return updated;
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [isChatLoading, messages]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput);
    }
  }, [chatInput, sendMessage]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <Search className="h-5 w-5 text-blue-600" />
          Investigación Legislativa
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Búsqueda de proyectos, análisis de contexto y asistencia conversacional para investigación jurídica.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Left Panel: Search ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Buscar Proyectos de Ley
            </h3>

            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="fintech, pagos, datos..."
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSearching || !searchQuery.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleKeywordClick(kw)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results */}
          <div
            className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            style={{ maxHeight: '560px' }}
          >
            {isSearching
              ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="ml-2 text-xs text-slate-500">Buscando...</span>
                  </div>
                )
              : !hasSearched
                  ? (
                      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                        <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                          Busca proyectos por palabra clave o usa las etiquetas rápidas
                        </p>
                      </div>
                    )
                  : searchResults.length === 0
                    ? (
                        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                          <p className="text-xs text-slate-500">Sin resultados para esa búsqueda</p>
                        </div>
                      )
                    : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            {searchResults.length}
                            {' resultados'}
                          </div>
                          {searchResults.map((r) => (
                            <div
                              key={r.boletin}
                              className="group px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                      {r.boletin}
                                    </span>
                                    {r.estado && (
                                      <span className="truncate text-xs text-slate-400">
                                        {r.estado}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-slate-800 dark:text-slate-200">
                                    {r.titulo}
                                  </p>
                                  {r.fechaIngreso && (
                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {r.fechaIngreso}
                                      {r.camara ? ` · ${r.camara}` : ''}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => askAboutProject(r)}
                                    className="rounded-md p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                                    title="Preguntar al agente"
                                  >
                                    <Bot className="h-3.5 w-3.5" />
                                  </button>
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                                    title="Ver en sitio oficial"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
          </div>
        </div>

        {/* ── Right Panel: AI Chat ─────────────────────────────────────────── */}
        <div className="flex h-[700px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 shadow-sm dark:bg-blue-900/30">
                  <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Agente Legislativo
                </h3>
                <p className="mb-6 max-w-sm text-xs text-slate-500">
                  Pregúntame sobre proyectos de ley, su estado, historial de cambios, o pídeme que envíe una alerta a Slack.
                </p>
                <div className="flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q, qi) => (
                    <button
                      key={qi}
                      type="button"
                      onClick={() => sendMessage(q)}
                      disabled={isChatLoading}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
                    >
                      <Sparkles className="h-3 w-3 shrink-0" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Bot avatar */}
                  {msg.role === 'assistant' && (
                    <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                      <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}

                  {/* Bubble */}
                  {msg.role === 'user'
                    ? (
                        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm">
                          {msg.content}
                        </div>
                      )
                    : (
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                          {msg.streaming && !msg.content
                            ? (
                              // Tool-call phase: bouncing dots
                                <div className="flex items-center gap-1.5 py-0.5">
                                  <span
                                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                                    style={{ animationDelay: '0ms' }}
                                  />
                                  <span
                                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                                    style={{ animationDelay: '150ms' }}
                                  />
                                  <span
                                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                                    style={{ animationDelay: '300ms' }}
                                  />
                                </div>
                              )
                            : (
                                <>
                                  <SimpleMarkdown text={msg.content} />
                                  {msg.streaming && (
                                    // Blinking cursor while text streams in
                                    <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-px animate-pulse bg-slate-500 dark:bg-slate-400" />
                                  )}
                                </>
                              )}
                        </div>
                      )}

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600">
                      <User className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Pregunta sobre proyectos o pide una alerta Slack..."
                className="flex-1 text-sm"
                disabled={isChatLoading}
              />
              <Button
                size="sm"
                onClick={() => sendMessage(chatInput)}
                disabled={!chatInput.trim() || isChatLoading}
                className="shrink-0"
              >
                {isChatLoading
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
