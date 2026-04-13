"use client";

import { CheckinQuestion } from "@/lib/types";
import { parseOption } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface QcmInputProps {
  question: CheckinQuestion;
  value: any;
  onChange: (value: any) => void;
}

export function QcmInput({ question, value, onChange }: QcmInputProps) {
  const min = question.min_value ?? (question.answer_type === "scale" ? 1 : 0);
  const max = question.max_value ?? (question.answer_type === "scale" ? 10 : 10);
  const stepValue = question.step ?? (question.answer_type === "time_hours" ? 0.5 : 1);

  if (question.answer_type === "scale") {
    const scalePoints = Array.from({ length: Math.max(1, max - min + 1) }, (_, idx) => min + idx);
    const optionLabels = question.options && question.options.length === scalePoints.length ? question.options : null;
    
    return (
      <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {scalePoints.map((score, idx) => (
          <button
            key={score}
            onClick={() => onChange(score)}
            className={cn(
              "aspect-square rounded-xl sm:rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-300 border backdrop-blur-sm",
              value === score 
                ? "bg-primary text-white shadow-sanctuary ring-2 ring-primary/20 scale-105 border-primary" 
                : "bg-surface-container/30 border-white/20 text-on-surface hover:bg-surface-container/50"
            )}
          >
            {optionLabels ? optionLabels[idx] : score}
          </button>
        ))}
      </div>
    );
  }

  if (question.answer_type === "boolean") {
    return (
      <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Button 
          variant={value === true ? "default" : "secondary"} 
          className={cn("flex-1 h-12 rounded-xl text-md font-bold transition-all", value === true && "shadow-sanctuary ring-2 ring-primary/20")}
          onClick={() => onChange(true)}
        >
          Oui (Yes)
        </Button>
        <Button 
          variant={value === false ? "default" : "secondary"} 
          className={cn("flex-1 h-12 rounded-xl text-md font-bold transition-all", value === false && "shadow-sanctuary ring-2 ring-primary/20")}
          onClick={() => onChange(false)}
        >
          Non (No)
        </Button>
      </div>
    );
  }

  if (question.answer_type === "single_choice" && question.options?.length) {
    const parsedOptions = question.options.map(parseOption);
    return (
      <div className="grid gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {parsedOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-300 font-medium text-sm",
              value === opt.value
                ? "bg-primary/10 border-primary/50 text-primary shadow-sm ring-1 ring-primary/10"
                : "bg-surface-container/30 border-white/10 text-on-surface hover:bg-surface-container/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.answer_type === "multi_choice" && question.options?.length) {
    const parsedOptions = question.options.map(parseOption);
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {parsedOptions.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() =>
                onChange(
                  isSelected ? selected.filter((item: string) => item !== opt.value) : [...selected, opt.value]
                )
              }
              className={cn(
                "w-full text-left px-5 py-4 rounded-2xl border transition-all duration-300 font-medium",
                isSelected
                  ? "bg-primary/10 border-primary text-primary shadow-sanctuary ring-2 ring-primary/10"
                  : "bg-surface-container/30 border-white/20 text-on-surface hover:bg-surface-container/50"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.answer_type === "time_hours" || question.answer_type === "number") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Input
          type="number"
          min={min}
          max={max}
          step={stepValue}
          value={typeof value === "number" ? value : ""}
          placeholder={`Ex: ${min}...`}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-12 rounded-xl bg-surface-container/30 border-white/10 text-md px-4"
        />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your reflection here..."
        className="min-h-[120px] rounded-2xl bg-surface-container/30 border-white/20 p-5 p-4 text-base resize-none"
      />
    </div>
  );
}
