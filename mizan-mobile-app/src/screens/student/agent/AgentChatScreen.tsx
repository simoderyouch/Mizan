import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ClipboardCheck,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  Send,
  Sparkles,
  Square,
} from "lucide-react-native";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import { Screen } from "../../../components/screen";
import { Button, ErrorBanner, styles as uiStyles } from "../../../components/ui";
import { agentApi, getApiErrorMessage, tasksApi, voiceApi } from "../../../lib/api";
import { waitForRecordingUri } from "../../../lib/native-upload";
import type { AgentChatMessage, ChatTaskSuggestion } from "../../../lib/types";
import type { MainStackParamList } from "../../../navigation/types";
import { colors, radius, spacing } from "../../../theme";
import { ChatTypingIndicator, VoiceCompanionOrb } from "../components";
import { todayIso } from "../constants";
import { usePlayback } from "../hooks/usePlayback";
import { ChatTaskSuggestions } from "./ChatTaskSuggestions";

const CHAT_STORAGE_KEY = "mizan:agent-chat-messages-v2";
const STARTER_PROMPTS = [
  "What should I focus on today?",
  "I'm feeling stressed — help me reset",
  "Turn our chat into tasks I can track",
  "How does Mizan support my wellbeing?",
] as const;

const OPENING_QUESTION_PROMPT =
  "Start this voice chat by asking me one short, friendly question in English about my current study situation.";

const INITIAL_MESSAGES: AgentChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi — I'm Mizan. I can help with your schedule, stress, and what to focus on next. What's on your mind?",
  },
];

function ChatBubble({ message }: { message: AgentChatMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <View style={[chatStyles.row, isAssistant ? chatStyles.rowStart : chatStyles.rowEnd]}>
      {isAssistant ? (
        <View style={chatStyles.avatar}>
          <Sparkles color={colors.primary} size={16} />
        </View>
      ) : null}
      <View style={[chatStyles.bubble, isAssistant ? chatStyles.assistantBubble : chatStyles.userBubble]}>
        <Text style={[chatStyles.bubbleText, !isAssistant && chatStyles.userBubbleText]}>{message.content}</Text>
      </View>
    </View>
  );
}


function ChatHeader({
  sending,
  onNewChat,
  onOpenContracts,
}: {
  sending: boolean;
  onNewChat: () => void;
  onOpenContracts: () => void;
}) {
  return (
    <View style={chatStyles.header}>
      <View style={chatStyles.headerLeft}>
        <View style={chatStyles.headerIconWrap}>
          <Sparkles color={colors.onPrimary} size={20} />
          <View style={[chatStyles.statusDot, sending ? chatStyles.statusDotBusy : chatStyles.statusDotReady]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={chatStyles.headerTitle}>Mizan AI</Text>
          <Text style={chatStyles.headerSub} numberOfLines={1}>
            {sending ? "Composing a reply…" : "Ask about focus, stress, or your schedule"}
          </Text>
        </View>
      </View>
      <View style={chatStyles.headerActions}>
        <Pressable onPress={onOpenContracts} style={chatStyles.headerBtn}>
          <ClipboardCheck color={colors.primary} size={16} />
        </Pressable>
        <Pressable onPress={onNewChat} style={[chatStyles.headerBtn, chatStyles.headerBtnPrimary]}>
          <MessageSquarePlus color={colors.primary} size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function VoiceChatHeader({ onBackToText, sessionActive }: { onBackToText: () => void; sessionActive?: boolean }) {
  return (
    <View style={chatStyles.header}>
      <View style={chatStyles.headerLeft}>
        <View style={chatStyles.headerIconWrap}>
          <Mic color={colors.onPrimary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={chatStyles.headerTitle}>Voice with Mizan</Text>
          <Text style={chatStyles.headerSub} numberOfLines={1}>
            {sessionActive ? "Session active — speak when ready" : "Tap start, then talk naturally"}
          </Text>
        </View>
      </View>
      <Pressable onPress={onBackToText} style={[chatStyles.headerBtn, chatStyles.headerBtnPrimary, chatStyles.voiceBackBtn]}>
        <MessageSquare color={colors.primary} size={16} />
        <Text style={chatStyles.voiceBackText}>Text chat</Text>
      </Pressable>
    </View>
  );
}

function AgentChatVoiceMode({
  messages,
  onBackToText,
  onMessagesUpdate,
  onSuggestions,
  onAgentAction,
  taskSuggestions,
  selectedSuggestions,
  creatingTasks,
  taskPreviewCollapsed,
  taskPreviewHidden,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onCreateTasks,
  onCollapseTasks,
  onHideTasks,
  onShowTasks,
}: {
  messages: AgentChatMessage[];
  onBackToText: () => void;
  onMessagesUpdate: (updater: (prev: AgentChatMessage[]) => AgentChatMessage[]) => void;
  onSuggestions: (items: ChatTaskSuggestion[]) => void;
  onAgentAction: (message: string) => void;
  taskSuggestions: ChatTaskSuggestion[];
  selectedSuggestions: Record<number, boolean>;
  creatingTasks: boolean;
  taskPreviewCollapsed: boolean;
  taskPreviewHidden: boolean;
  onToggleSelected: (idx: number, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCreateTasks: () => void;
  onCollapseTasks: (collapsed: boolean) => void;
  onHideTasks: () => void;
  onShowTasks: () => void;
}) {
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const { play: playAgentAudio, isPlaying } = usePlayback(audioUri);
  const insets = useSafeAreaInsets();
  const isProcessing = loading || isTranscribing;

  useEffect(() => {
    if (audioUri) playAgentAudio();
  }, [audioUri, playAgentAudio]);

  const sendVoice = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content }));

    onMessagesUpdate((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);
    setError("");
    onSuggestions([]);

    try {
      const res = await voiceApi.chat({ user_text: trimmed, history });
      onMessagesUpdate((prev) => [...prev, { role: "assistant", content: res.agent_text }]);
      if (res.agent_audio_base64) {
        setAudioUri(`data:audio/mp3;base64,${res.agent_audio_base64}`);
      } else {
        setAudioUri(null);
      }
      if (res.agent_action?.took_action && res.agent_action.message) {
        onAgentAction(res.agent_action.message);
      }
      try {
        const suggested = await tasksApi.suggestFromChat({
          user_message: trimmed,
          assistant_message: res.agent_text,
        });
        onSuggestions(suggested.suggestions ?? []);
      } catch {
        onSuggestions([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not reach Mizan voice."));
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async () => {
    setSessionActive(true);
    setError("");
    onSuggestions([]);
    await sendVoice(OPENING_QUESTION_PROMPT);
  };

  const stopConversation = () => {
    if (recording) {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
      setRecording(false);
    }
    setSessionActive(false);
    setAudioUri(null);
    setError("");
    onSuggestions([]);
  };

  const startRecording = async () => {
    if (recording || isProcessing) return;
    setError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Please allow microphone access.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start recording."));
    }
  };

  const sendCurrentRecording = async () => {
    if (!recording || isProcessing) return;
    setIsTranscribing(true);
    setError("");
    try {
      recorder.stop();
      setRecording(false);
      const uri = await waitForRecordingUri(() => recorder.uri);
      if (!uri) {
        setError("No audio captured. Try again closer to the microphone.");
        return;
      }
      const res = await voiceApi.transcribe({
        uri,
        name: `voice-chat-${Date.now()}.m4a`,
        type: Platform.OS === "android" ? "audio/mp4" : "audio/m4a",
      });
      const transcription = res.transcription.trim();
      if (!transcription) {
        setError("No speech detected. Try again closer to the microphone.");
        return;
      }
      await sendVoice(transcription);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not transcribe audio."));
    } finally {
      setIsTranscribing(false);
    }
  };

  const statusLabel = (() => {
    if (sessionActive && recording) return "Recording…";
    if (isProcessing) return "Thinking…";
    if (isPlaying) return "Speaking…";
    if (sessionActive) return "Ready — tap record when you want to answer";
    return "Press Start to begin";
  })();

  const statusTone =
    sessionActive && recording
      ? chatStyles.voiceStatusRecording
      : isProcessing || isPlaying
        ? chatStyles.voiceStatusActive
        : chatStyles.voiceStatusMuted;

  return (
    <View style={[chatStyles.flex, { paddingBottom: Math.max(insets.bottom, spacing.sm), paddingHorizontal: spacing.lg }]}>
      <VoiceChatHeader onBackToText={onBackToText} sessionActive={sessionActive} />
      <ErrorBanner message={error} />
      <View style={chatStyles.voiceBodyCenter}>
        <VoiceCompanionOrb isRecording={recording} isProcessing={isProcessing} isPlaying={isPlaying} />
        <Text style={[chatStyles.voiceHint, statusTone]}>{statusLabel}</Text>
      </View>

      <ChatTaskSuggestions
        suggestions={taskSuggestions}
        selected={selectedSuggestions}
        collapsed={taskPreviewCollapsed}
        hidden={taskPreviewHidden}
        creating={creatingTasks}
        onToggleSelected={onToggleSelected}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        onCreate={onCreateTasks}
        onCollapse={onCollapseTasks}
        onHide={onHideTasks}
        onShow={onShowTasks}
      />

      <View style={chatStyles.voiceFooter}>
        <View style={chatStyles.voiceControls}>
          {!sessionActive ? (
            <Button disabled={isProcessing} onPress={() => void startConversation()} style={chatStyles.voicePrimaryBtn}>
              <Mic color={colors.onPrimary} size={16} />
              <Text style={chatStyles.voicePrimaryBtnText}>Start session</Text>
            </Button>
          ) : (
            <>
              {!recording ? (
                <Button disabled={isProcessing} onPress={() => void startRecording()} style={chatStyles.voicePrimaryBtn}>
                  <Mic color={colors.onPrimary} size={16} />
                  <Text style={chatStyles.voicePrimaryBtnText}>Record answer</Text>
                </Button>
              ) : null}
              <Button
                variant="secondary"
                disabled={isProcessing || !recording}
                onPress={() => void sendCurrentRecording()}
                style={chatStyles.voiceSecondaryBtn}
              >
                {isProcessing ? (
                  <Loader2 color={colors.text} size={16} />
                ) : (
                  <Send color={colors.text} size={16} />
                )}
                <Text style={chatStyles.voiceSecondaryBtnText}>Send</Text>
              </Button>
              <Button variant="danger" onPress={stopConversation} style={chatStyles.voiceSecondaryBtn}>
                <Square color={colors.onPrimary} fill={colors.onPrimary} size={16} />
                <Text style={chatStyles.voiceDangerBtnText}>End</Text>
              </Button>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function AgentChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AgentChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [sending, setSending] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [taskSuggestions, setTaskSuggestions] = useState<ChatTaskSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskPreviewCollapsed, setTaskPreviewCollapsed] = useState(false);
  const [taskPreviewHidden, setTaskPreviewHidden] = useState(false);
  const [error, setError] = useState("");
  const [actionBanner, setActionBanner] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const showWelcome = messages.length <= 1 && !sending;

  useEffect(() => {
    void AsyncStorage.getItem(CHAT_STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AgentChatMessage[];
          if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
        } catch {
          // ignore
        }
      }
      setStorageLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    void AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-24)));
  }, [messages, storageLoaded]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, sending, taskSuggestions.length]);

  const sendMessageWithText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setSending(true);
      setError("");
      setTaskSuggestions([]);
      setSelectedSuggestions({});
      setTaskPreviewCollapsed(false);
      setTaskPreviewHidden(false);

      try {
        const historyForApi = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-24)
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await agentApi.chat(trimmed, historyForApi);
        const assistantContent = res.response ?? "I couldn't generate a response right now.";
        setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
        if (res.agent_action?.took_action && res.agent_action.message) {
          setActionBanner(res.agent_action.message);
        }
        try {
          const suggestionRes = await tasksApi.suggestFromChat({
            user_message: trimmed,
            assistant_message: assistantContent,
          });
          setTaskSuggestions(suggestionRes.suggestions ?? []);
        } catch {
          setTaskSuggestions([]);
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not reach Mizan AI."));
      } finally {
        setSending(false);
      }
    },
    [messages, sending]
  );

  const createTasksFromSuggestions = async () => {
    const tasks = taskSuggestions
      .map((item, idx) => ({ item, idx }))
      .filter(({ idx }) => selectedSuggestions[idx] ?? true)
      .map(({ item }) => ({
        title: item.title,
        description: item.description ?? undefined,
        due_date: todayIso(),
        source: "chat" as const,
      }));
    if (!tasks.length) return;
    setCreatingTasks(true);
    try {
      await tasksApi.createMany({ tasks });
      setTaskSuggestions([]);
      setSelectedSuggestions({});
      setActionBanner(`${tasks.length} task${tasks.length === 1 ? "" : "s"} added to your list.`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create tasks from this suggestion."));
    } finally {
      setCreatingTasks(false);
    }
  };

  const resetChat = () => {
    setMessages(INITIAL_MESSAGES);
    setInput("");
    setTaskSuggestions([]);
    setSelectedSuggestions({});
    setTaskPreviewCollapsed(false);
    setTaskPreviewHidden(false);
    setActionBanner("");
    void AsyncStorage.removeItem(CHAT_STORAGE_KEY);
  };

  if (mode === "voice") {
    return (
      <Screen scroll={false} padded={false} variant="tab">
        <AgentChatVoiceMode
          messages={messages}
          onBackToText={() => setMode("text")}
          onMessagesUpdate={setMessages}
          onSuggestions={setTaskSuggestions}
          onAgentAction={setActionBanner}
          taskSuggestions={taskSuggestions}
          selectedSuggestions={selectedSuggestions}
          creatingTasks={creatingTasks}
          taskPreviewCollapsed={taskPreviewCollapsed}
          taskPreviewHidden={taskPreviewHidden}
          onToggleSelected={(idx, checked) =>
            setSelectedSuggestions((prev) => ({ ...prev, [idx]: checked }))
          }
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
          onCreateTasks={() => void createTasksFromSuggestions()}
          onCollapseTasks={setTaskPreviewCollapsed}
          onHideTasks={() => setTaskPreviewHidden(true)}
          onShowTasks={() => setTaskPreviewHidden(false)}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} variant="tab">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={chatStyles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={chatStyles.shell}>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ChatHeader
              sending={sending}
              onNewChat={resetChat}
              onOpenContracts={() => navigation.navigate("AgentContracts")}
            />
            {actionBanner ? (
              <View style={chatStyles.actionBanner}>
                <Text style={chatStyles.actionBannerText}>{actionBanner}</Text>
                <Pressable onPress={() => setActionBanner("")} hitSlop={8}>
                  <Text style={chatStyles.actionDismiss}>Dismiss</Text>
                </Pressable>
              </View>
            ) : null}
            <ErrorBanner message={error} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={chatStyles.flex}
            contentContainerStyle={chatStyles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m, idx) => (
              <ChatBubble key={`${m.role}-${idx}-${m.content.slice(0, 16)}`} message={m} />
            ))}
            {sending ? <ChatTypingIndicator /> : null}
            {showWelcome ? (
              <View style={chatStyles.welcome}>
                <Text style={chatStyles.welcomeTitle}>Quick prompts</Text>
                <Text style={uiStyles.muted}>Tap one to start, or type your own message below.</Text>
                <View style={chatStyles.promptGrid}>
                  {STARTER_PROMPTS.map((text) => (
                    <Pressable
                      key={text}
                      disabled={sending}
                      onPress={() => void sendMessageWithText(text)}
                      style={({ pressed }) => [chatStyles.promptChip, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={chatStyles.promptText}>{text}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={[chatStyles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ChatTaskSuggestions
                suggestions={taskSuggestions}
                selected={selectedSuggestions}
                collapsed={taskPreviewCollapsed}
                hidden={taskPreviewHidden}
                creating={creatingTasks}
                onToggleSelected={(idx, checked) =>
                  setSelectedSuggestions((prev) => ({ ...prev, [idx]: checked }))
                }
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

              <View style={chatStyles.composer}>
                <Pressable onPress={() => setMode("voice")} style={chatStyles.composerMic}>
                  <Mic color={colors.muted} size={22} />
                </Pressable>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message Mizan…"
                  placeholderTextColor="rgba(66,71,81,0.5)"
                  style={chatStyles.composerInput}
                  editable={!sending}
                  multiline
                  onSubmitEditing={() => void sendMessageWithText(input)}
                  returnKeyType="send"
                />
                <Pressable
                  disabled={!input.trim() || sending}
                  onPress={() => void sendMessageWithText(input)}
                  style={[
                    chatStyles.composerSend,
                    !input.trim() && !sending && chatStyles.sendDisabled,
                    sending && chatStyles.composerSendBusy,
                  ]}
                >
                  <Send color={input.trim() && !sending ? colors.onPrimary : colors.muted} size={18} />
                </Pressable>
              </View>
            
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const chatStyles = StyleSheet.create({
  flex: { flex: 1 },
  shell: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  headerIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  statusDot: {
    borderColor: colors.background,
    borderRadius: 999,
    borderWidth: 2,
    bottom: -1,
    height: 10,
    position: "absolute",
    right: -1,
    width: 10,
  },
  statusDotReady: { backgroundColor: colors.success },
  statusDotBusy: { backgroundColor: colors.warning },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  headerSub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  headerBtn: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerBtnPrimary: {
    backgroundColor: colors.primarySoft,
  },
  voiceBackBtn: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    width: "auto",
  },
  voiceBackText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  messagesContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  rowStart: { justifyContent: "flex-start" },
  rowEnd: { justifyContent: "flex-end" },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    marginTop: 2,
    width: 32,
  },
  bubble: {
    borderRadius: radius.lg,
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  assistantBubble: {
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.35)",
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderTopRightRadius: radius.sm,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: colors.onPrimary,
  },
  welcome: {
    backgroundColor: "rgba(246,243,242,0.9)",
    borderColor: "rgba(194,198,211,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  promptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  promptChip: {
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.35)",
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  promptText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: "rgba(194,198,211,0.2)",
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  composer: {
    alignItems: "flex-end",
    backgroundColor: "rgba(246,243,242,0.65)",
    borderColor: "rgba(194,198,211,0.35)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  composerMic: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  composerInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  composerSend: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sendDisabled: {
    backgroundColor: "transparent",
    opacity: 0.5,
  },
  composerSendBusy: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
  composerHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing.xs,
    opacity: 0.75,
    textAlign: "center",
  },
  actionBanner: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionBannerText: {
    color: colors.success,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  actionDismiss: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  voiceBodyCenter: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xl,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  voiceHint: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  voiceStatusRecording: {
    color: colors.danger,
  },
  voiceStatusActive: {
    color: colors.primary,
  },
  voiceStatusMuted: {
    color: colors.muted,
  },
  voiceFooter: {
    borderTopColor: "rgba(194,198,211,0.2)",
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  voiceControls: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  voicePrimaryBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  voicePrimaryBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  voiceSecondaryBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  voiceSecondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  voiceDangerBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
});
