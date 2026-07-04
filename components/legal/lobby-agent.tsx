'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { radarConfig } from '~/config/radar.config';
import { AiUnavailableNotice } from '~/components/legal/ai-unavailable-notice';

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Preguntas sugeridas desde la configuración temática (config/radar.config.ts)
const SUGGESTED_QUESTIONS = radarConfig.lobbySuggestedQuestions;

export function LobbyAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/legal/lobby/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = response.status === 429
          ? (data.error ?? 'Límite de solicitudes alcanzado. Espera unos segundos e intenta de nuevo.')
          : (data.error ?? 'Error al comunicarse con el agente');
        throw new Error(msg);
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'No se pudo conectar con el agente.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AiUnavailableNotice />
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 mb-4">
              <Bot className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">
              Agente de Análisis de Lobby
            </h3>
            <p className="text-xs text-stone-500 max-w-md mb-6">
              Pregúntame sobre audiencias de lobby, relaciones entre instituciones, frecuencia de reuniones, o cualquier análisis sobre los datos de InfoLobby.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-300 dark:hover:border-orange-600 dark:hover:bg-orange-900/30"
                >
                  <Sparkles className="h-3 w-3" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Bot className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-orange-600 text-white'
                  : 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-600">
                <User className="h-4 w-4 text-stone-600 dark:text-stone-300" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Bot className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-stone-100 px-3.5 py-2.5 dark:bg-stone-800">
              <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
              <span className="text-xs text-stone-500">Analizando datos...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-stone-200 p-3 dark:border-stone-800">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta sobre audiencias de lobby..."
            className="flex-1 text-sm"
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
