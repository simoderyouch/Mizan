"use client";

import { useEffect, useRef, useState } from "react";
import { agentApi, getApiErrorMessage, tasksApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import type { AgentChatMessage, ChatTaskSuggestion } from "@/lib/types";
import { Loader2, Send, Mic, X, Sparkles, ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import { VoiceCompanion } from "@/components/agent/voice-companion";
import { RichTextMessage } from "@/components/agent/rich-text-message";

const CHAT_STORAGE_KEY = "mizan_agent_chat_history_v1";
const INITIAL_CHAT_MESSAGES: AgentChatMessage[] = [
  {
    role: "assistant",
    content: "Hi, I’m Mizan AI. I’m here to help with your schedule and wellbeing. How can I help you today?",
  },
];

export default function AgentChatPage() {
  const [messages, setMessages] = useState<AgentChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [taskSuggestions, setTaskSuggestions] = useState<ChatTaskSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskPreviewCollapsed, setTaskPreviewCollapsed] = useState(false);
  const [taskPreviewHidden, setTaskPreviewHidden] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      setStorageLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AgentChatMessage[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setStorageLoaded(true);
        return;
      }
      const sanitized = parsed
        .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
        .map((item) => ({ role: item.role, content: item.content })) as AgentChatMessage[];
      if (sanitized.length > 0) {
        setMessages(sanitized);
      }
    } catch {
      // ignore invalid local storage payload
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !storageLoaded) return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages, storageLoaded]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehaviorY;
    const previousHtmlOverscroll = documentElement.style.overscrollBehaviorY;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    documentElement.style.overscrollBehaviorY = "none";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overscrollBehaviorY = previousBodyOverscroll;
      documentElement.style.overscrollBehaviorY = previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: AgentChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await agentApi.chat(text);
      const assistantMsg: AgentChatMessage = {
        role: "assistant",
        content: res.response ?? "I couldn't generate a response right now.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      try {
        const suggestionRes = await tasksApi.suggestFromChat({
          user_message: text,
          assistant_message: assistantMsg.content,
        });
        setTaskSuggestions(suggestionRes.suggestions);
        setSelectedSuggestions({});
        setTaskPreviewCollapsed(false);
        setTaskPreviewHidden(false);
      } catch {
        setTaskSuggestions([]);
      }
    } catch (err: unknown) {
      toast({
        title: "Chat error",
        description: getApiErrorMessage(err, "Could not reach Mizan AI."),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const createTasksFromSuggestions = async () => {
    const tasks = taskSuggestions
      .map((item, idx) => ({ item, idx }))
      .filter(({ idx }) => selectedSuggestions[idx] ?? true)
      .map(({ item }) => ({
        title: item.title,
        description: item.description ?? undefined,
        source: "chat" as const,
      }));
    if (!tasks.length) return;
    setCreatingTasks(true);
    try {
      await tasksApi.createMany({ tasks });
      setTaskSuggestions([]);
      setSelectedSuggestions({});
    } catch (err: unknown) {
      toast({
        title: "Task creation error",
        description: getApiErrorMessage(err, "Could not create tasks from this suggestion."),
        variant: "destructive",
      });
    } finally {
      setCreatingTasks(false);
    }
  };

  const selectedSuggestionCount = taskSuggestions.filter((_, idx) => selectedSuggestions[idx] ?? true).length;

  const selectAllSuggestions = () => {
    const next: Record<number, boolean> = {};
    taskSuggestions.forEach((_, idx) => {
      next[idx] = true;
    });
    setSelectedSuggestions(next);
  };

  const clearSuggestionsSelection = () => {
    const next: Record<number, boolean> = {};
    taskSuggestions.forEach((_, idx) => {
      next[idx] = false;
    });
    setSelectedSuggestions(next);
  };

  const resetChat = () => {
    setMessages(INITIAL_CHAT_MESSAGES);
    setTaskSuggestions([]);
    setSelectedSuggestions({});
    setTaskPreviewCollapsed(false);
    setTaskPreviewHidden(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center overflow-hidden rounded-xl  overscroll-none">
      {mode === "text" ? (
        <div className="relative z-10 flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden px-2 sm:px-4">

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Mizan AI</h1>
                <p className="text-xs text-on-surface-variant font-medium">Always listening</p>
              </div>
            </div>

            {/* Top Right Action */}
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-primary hover:bg-primary/10"
              onClick={resetChat}
            >
              New chat
            </Button>
          </div>

          {/* Chat History Area */}
          <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain pb-10 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:pb-32">
            <div className="flex flex-col space-y-6">
              {messages.map((m, idx) => (
                <div key={`${m.role}-${idx}`} className={`flex w-full ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`relative max-w-[85%] sm:max-w-[75%] px-5 py-3.5 text-[15px] shadow-sm ${m.role === "assistant"
                      ? "bg-surface-container border border-transparent rounded-3xl rounded-tl-sm text-on-surface"
                      : "bg-primary border border-primary/20 text-white rounded-3xl rounded-tr-sm"
                      }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="flex flex-col gap-2">
                        <RichTextMessage content={m.content} />
                      </div>
                    ) : (
                      <RichTextMessage content={m.content} />
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start w-full">
                  <div className="bg-surface-container rounded-3xl rounded-tl-sm px-5 py-3 text-[15px] flex items-center gap-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-on-surface-variant animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Floating Input Area (Absolute positioned bottom) */}
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+3.3rem)] left-0 z-20 w-full px-2 sm:px-4">
            <div className="max-w-4xl mx-auto">
              {taskSuggestions.length > 0 && !taskPreviewHidden && (
                <div className="mb-3">
                  {!taskPreviewCollapsed ? (
                    <div className="border border-2 bg-white/90 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                          <p className="font-semibold">Proposed tasks</p>
                          <p className="text-xs text-on-surface-variant">Select what you want to validate and create.</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                            {selectedSuggestionCount}/{taskSuggestions.length} selected
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTaskPreviewCollapsed(true)}
                            className="h-8 w-8 rounded-full"
                            aria-label="Collapse task preview"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTaskPreviewHidden(true)}
                            className="h-8 w-8 rounded-full"
                            aria-label="Hide task preview"
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                        {taskSuggestions.map((suggestion, idx) => (
                          <label
                            key={`${suggestion.title}-${idx}`}
                            className="group flex items-start gap-3 text-sm rounded-lg border bg-surface p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSuggestions[idx] ?? true}
                              onChange={(e) => setSelectedSuggestions((prev) => ({ ...prev, [idx]: e.target.checked }))}
                              className="mt-1 h-4 w-4 accent-primary"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block font-medium text-on-surface leading-snug">{suggestion.title}</span>
                              {suggestion.description ? (
                                <span className="block text-xs text-on-surface-variant mt-0.5 line-clamp-2">{suggestion.description}</span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={selectAllSuggestions}
                          >
                            Select all
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={clearSuggestionsSelection}
                          >
                            Clear
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void createTasksFromSuggestions()}
                          disabled={creatingTasks || selectedSuggestionCount === 0}
                        >
                          {creatingTasks ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Validate and create selected tasks
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-2 bg-white/90 px-3 py-2 shadow-sm">
                        <span className="text-sm font-medium">Proposed tasks ({selectedSuggestionCount}/{taskSuggestions.length})</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setTaskPreviewCollapsed(false)}
                          className="h-8 w-8 rounded-full"
                          aria-label="Expand task preview"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {taskSuggestions.length > 0 && taskPreviewHidden && (
                <div className="mb-3 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setTaskPreviewHidden(false)}
                    className="rounded-full bg-white/90"
                  >
                    Show proposed tasks ({taskSuggestions.length})
                  </Button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 bg-surface/80 backdrop-blur-xl border border-white/20 p-2 rounded-2xl shadow-sanctuary hover:shadow-sanctuary-lg transition-all duration-300 w-full">



                <div className="flex-1 w-full min-w-0 flex items-center">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message Mizan AI..."
                    className="border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-6 text-base w-full placeholder:text-on-surface-variant/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    disabled={sending}
                  />
                </div>
                <div className="flex">  <div className="flex items-center justify-center pl-2 shrink-0">
                  <Button
                    onClick={() => setMode("voice")}
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
                  <div className="flex items-center pr-1 shrink-0 pt-2 sm:pt-0 pb-1 sm:pb-0">
                    <Button
                      onClick={() => void sendMessage()}
                      disabled={sending || !input.trim()}
                      size="icon"
                      className={`h-12 w-12 rounded-full transition-all duration-300 ${input.trim()
                        ? "bg-primary text-white hover:scale-105 hover:bg-primary/90 shadow-md"
                        : "bg-surface-container-high  cursor-not-allowed hover:bg-surface-container-high"
                        }`}
                    >
                      <Send className={`h-5 w-5 `} />
                    </Button>
                  </div></div>
              </div>
              <div className="text-center mt-2">
                <p className="text-[11px] text-on-surface-variant/60 font-medium">
                  Mizan can make mistakes. Please verify important details.
                </p>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Voice Mode Overlay Fullscreen */
        <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-surface/95 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">

          <div className="flex justify-between items-center p-6 shrink-0 w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary text-white shadow-lg">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Voice call</h2>
                <p className="text-sm text-on-surface-variant">Speak freely with Mizan in real time</p>
              </div>
            </div>

            <Button
              onClick={() => setMode("text")}
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 border border-outline-variant hover:bg-surface-container-high hover:text-primary transition-all"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0 w-full relative">
            {/* The Voice Companion Handles the Microphone, Recording, and Audio playback state internally */}
            <VoiceCompanion />
          </div>

        </div>
      )}

    </div>
  );
}
