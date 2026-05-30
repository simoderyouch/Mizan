import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AlertTriangle, Sparkles } from "lucide-react-native";
import { Button, Field, LoadingState } from "../../../components/ui";
import type { CheckinQuestion, QuestionSource } from "../../../lib/types";
import { colors, spacing } from "../../../theme";
import { normalizeCheckinOptions } from "../utils";
import { checkinStyles as s } from "./checkinStyles";

function isAnswered(
  question: CheckinQuestion,
  answers: Record<string, string | number | boolean | string[]>
): boolean {
  const value = answers[question.id];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function ScaleInput({
  question,
  value,
  onChange,
}: {
  question: CheckinQuestion;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const min = question.min_value ?? 1;
  const max = question.max_value ?? 10;
  const step = question.step ?? 1;
  const pills: number[] = [];
  for (let i = min; i <= max; i += step) pills.push(i);

  const parsedOptions = normalizeCheckinOptions(question.options);
  const optionLabels =
    parsedOptions.length === pills.length
      ? parsedOptions.map((o) => displayOptionLabel(o))
      : null;

  return (
    <View style={s.scaleWrap}>
      {pills.map((n, idx) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[s.scaleChip, active && s.scaleChipActive, optionLabels ? { maxWidth: "48%" } : null]}
          >
            <Text style={[s.scaleChipText, active && s.scaleChipTextActive]}>
              {optionLabels ? optionLabels[idx] : n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function displayOptionLabel(option: { value: string; label: string }): string {
  const label = String(option.label ?? "").trim();
  const value = String(option.value ?? "").trim();
  return label || value;
}

function OptionTile({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const text = String(label ?? "").trim();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.optionTile,
        active && s.optionTileActive,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <Text style={[s.optionTileText, active && s.optionTileTextActive]}>{text}</Text>
    </Pressable>
  );
}

function ChoiceOptions({
  options,
  selected,
  multi,
  onSelect,
}: {
  options: ReturnType<typeof normalizeCheckinOptions>;
  selected: string | string[] | undefined;
  multi: boolean;
  onSelect: (value: string) => void;
}) {
  const selectedValues = multi
    ? Array.isArray(selected)
      ? selected
      : []
    : typeof selected === "string"
      ? [selected]
      : [];

  return (
    <View style={s.optionList}>
      {options.map((option) => {
        const active = selectedValues.includes(option.value);
        return (
          <OptionTile
            key={option.value}
            active={active}
            label={displayOptionLabel(option)}
            onPress={() => onSelect(option.value)}
          />
        );
      })}
    </View>
  );
}

export function QuestionForm({
  questions,
  answers,
  onAnswer,
  source,
  loading = false,
  error,
  onRetry,
  onSubmit,
  submitting = false,
  onChangeFormat,
  onStepChange,
}: {
  questions: CheckinQuestion[];
  answers: Record<string, string | number | boolean | string[]>;
  onAnswer: (id: string, value: string | number | boolean | string[]) => void;
  source?: QuestionSource;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  onChangeFormat: () => void;
  onStepChange?: (index: number) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  const setStep = (next: number | ((prev: number) => number)) => {
    setStepIndex((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      onStepChange?.(value);
      return value;
    });
  };

  if (loading) {
    return (
      <View style={s.surface}>
        <LoadingState label="Loading questions..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.surface}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <AlertTriangle color={colors.warning} size={18} />
          <Text style={{ color: colors.warning, flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
            {error}
          </Text>
        </View>
        {onRetry ? (
          <Button onPress={onRetry} style={{ marginTop: spacing.md }} variant="secondary">
            Try again
          </Button>
        ) : null}
      </View>
    );
  }

  if (!questions.length) return null;

  const question = questions[stepIndex] ?? questions[0];
  const isLast = stepIndex === questions.length - 1;
  const canAdvance = !question.required || isAnswered(question, answers);

  const renderInput = (q: CheckinQuestion) => {
    switch (q.answer_type) {
      case "scale":
        return (
          <ScaleInput
            question={q}
            value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : undefined}
            onChange={(v) => onAnswer(q.id, v)}
          />
        );

      case "single_choice":
        return (
          <ChoiceOptions
            multi={false}
            onSelect={(value) => onAnswer(q.id, value)}
            options={normalizeCheckinOptions(q.options)}
            selected={answers[q.id] as string | undefined}
          />
        );

      case "multi_choice": {
        const selected = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
        return (
          <ChoiceOptions
            multi
            onSelect={(value) => {
              const next = selected.includes(value)
                ? selected.filter((o) => o !== value)
                : [...selected, value];
              onAnswer(q.id, next);
            }}
            options={normalizeCheckinOptions(q.options)}
            selected={selected}
          />
        );
      }

      case "boolean":
        return (
          <View style={[s.optionList, { flexDirection: "row", gap: spacing.sm }]}>
            {[true, false].map((value) => (
              <View key={String(value)} style={{ flex: 1 }}>
                <OptionTile
                  active={answers[q.id] === value}
                  label={value ? "Yes" : "No"}
                  onPress={() => onAnswer(q.id, value)}
                />
              </View>
            ))}
          </View>
        );

      case "time_hours":
        return (
          <Field
            keyboardType="decimal-pad"
            onChangeText={(v) => {
              const num = parseFloat(v);
              onAnswer(q.id, Number.isFinite(num) ? num : v);
            }}
            placeholder="e.g. 7.5 hours"
            value={String(answers[q.id] ?? "")}
          />
        );

      case "number":
        return (
          <Field
            keyboardType="numeric"
            onChangeText={(value) => {
              const num = Number(value);
              onAnswer(q.id, Number.isFinite(num) ? num : value);
            }}
            placeholder="Enter a number"
            value={String(answers[q.id] ?? "")}
          />
        );

      case "text":
      case "voice_text":
      default:
        return (
          <Field
            multiline
            onChangeText={(value) => onAnswer(q.id, value)}
            placeholder="Type your answer..."
            value={String(answers[q.id] ?? "")}
            style={{ minHeight: 96, textAlignVertical: "top" }}
          />
        );
    }
  };

  const goNext = () => {
    if (!canAdvance) return;
    if (isLast) {
      onSubmit();
      return;
    }
    setStep((i) => Math.min(questions.length - 1, i + 1));
  };

  return (
    <View style={s.surface}>
      {source === "llm" ? (
        <View style={s.sourcePill}>
          <Sparkles color={colors.primary} size={11} />
          <Text style={s.sourcePillText}>Personalized for you</Text>
        </View>
      ) : null}

      <Text style={s.questionText}>
        {question.text}
        {question.required ? <Text style={{ color: colors.primary }}> *</Text> : null}
      </Text>

      {renderInput(question)}

      <View style={s.formFooter}>
        <Button
          disabled={!canAdvance}
          loading={isLast && submitting}
          onPress={goNext}
        >
          {isLast ? "Submit check-in" : "Continue"}
        </Button>

        {stepIndex > 0 ? (
          <Button onPress={() => setStep((i) => Math.max(0, i - 1))} variant="ghost">
            Previous question
          </Button>
        ) : (
          <Pressable onPress={onChangeFormat} style={s.linkBtn}>
            <Text style={s.linkBtnText}>Choose a different format</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
