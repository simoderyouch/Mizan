"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/agent/chat/chat-composer";
import { ChatHeader } from "@/components/agent/chat/chat-header";
import { VoiceChatHeader } from "@/components/agent/chat/voice-chat-header";
import { ChatMessage, ChatTypingIndicator } from "@/components/agent/chat/chat-message";
import { ChatShell } from "@/components/agent/chat/chat-shell";
import { ChatWelcome } from "@/components/agent/chat/chat-welcome";
import { ChatTaskSuggestions } from "@/components/agent/chat/chat-task-suggestions";
import { VoiceCompanion } from "@/components/agent/voice-companion";
import { agentApi, getApiErrorMessage, tasksApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { AgentChatMessage, ChatTaskSuggestion } from "@/lib/types";

const CHAT_STORAGE_KEY = "mizan_agent_chat_history_v1";

const INITIAL_CHAT_MESSAGES: AgentChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi — I’m Mizan. I can help with your schedule, stress, and what to focus on next. What’s on your mind?",
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

  const showWelcome = messages.length <= 1 && !sending;

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
        .filter(
          (item) =>
            item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string"
        )
        .map((item) => ({ role: item.role, content: item.content })) as AgentChatMessage[];
      if (sanitized.length > 0) setMessages(sanitized);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, taskSuggestions.length, taskPreviewCollapsed]);

  const sendMessageWithText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: AgentChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);

      try {
        const historyForApi = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-24)
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await agentApi.chat(trimmed, historyForApi);
        const assistantMsg: AgentChatMessage = {
          role: "assistant",
          content: res.response ?? "I couldn't generate a response right now.",
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (res.agent_action?.took_action && res.agent_action.message) {
          toast({
            title: "Mizan took action",
            description: res.agent_action.message,
            variant: "success",
          });
          window.dispatchEvent(new CustomEvent("mizan:notifications:refresh"));
        }
        try {
          const suggestionRes = await tasksApi.suggestFromChat({
            user_message: trimmed,
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
    },
    [sending, toast]
  );

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
      toast({
        title: "Tasks added",
        description: `${tasks.length} task${tasks.length === 1 ? "" : "s"} added to your list.`,
        variant: "success",
      });
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

  const resetChat = () => {
    setMessages(INITIAL_CHAT_MESSAGES);
    setInput("");
    setTaskSuggestions([]);
    setSelectedSuggestions({});
    setTaskPreviewCollapsed(false);
    setTaskPreviewHidden(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  };

  const taskSuggestionsFooter = (
    <ChatTaskSuggestions
      suggestions={taskSuggestions}
      selected={selectedSuggestions}
      collapsed={taskPreviewCollapsed}
      hidden={taskPreviewHidden}
      creating={creatingTasks}
      onToggleSelected={(idx, checked) => setSelectedSuggestions((prev) => ({ ...prev, [idx]: checked }))}
      onSelectAll={() => {
        const next: Record<number, boolean> = {};
        taskSuggestions.forEach((_, idx) => {
          next[idx] = true;
        });
        setSelectedSuggestions(next);
      }}
      onClearSelection={() => {
        const next: Record<number, boolean> = {};
        taskSuggestions.forEach((_, idx) => {
          next[idx] = false;
        });
        setSelectedSuggestions(next);
      }}
      onCreate={() => void createTasksFromSuggestions()}
      onCollapse={setTaskPreviewCollapsed}
      onHide={() => setTaskPreviewHidden(true)}
      onShow={() => setTaskPreviewHidden(false)}
    />
  );

  const composerFooter = (
    <ChatComposer
      value={input}
      onChange={setInput}
      onSend={() => void sendMessageWithText(input)}
      onVoice={() => setMode("voice")}
      sending={sending}
    />
  );

  if (mode === "voice") {
    return (
      <div className="page-enter w-full">
        <ChatShell
          variant="voice"
          header={<VoiceChatHeader onBackToText={() => setMode("text")} />}
        >
          <VoiceCompanion />
        </ChatShell>
      </div>
    );
  }

  return (
    <div className="page-enter w-full">
    <ChatShell
      header={<ChatHeader sending={sending} onNewChat={resetChat} />}
      footer={
        <>
          {taskSuggestionsFooter}
          {composerFooter}
        </>
      }
    >
      {messages.map((m, idx) => (
        <ChatMessage key={`${m.role}-${idx}-${m.content.slice(0, 24)}`} message={m} />
      ))}
      {sending ? <ChatTypingIndicator /> : null}
      {showWelcome ? (
        <ChatWelcome disabled={sending} onSelectPrompt={(text) => void sendMessageWithText(text)} />
      ) : null}
      <div ref={messagesEndRef} className="h-1 shrink-0" />
    </ChatShell>
    </div>
  );
}
