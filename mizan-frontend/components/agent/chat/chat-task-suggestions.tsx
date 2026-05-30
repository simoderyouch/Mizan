"use client";

import { ChevronDown, ChevronUp, EyeOff, ListPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatTaskSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatTaskSuggestionsProps = {
  suggestions: ChatTaskSuggestion[];
  selected: Record<number, boolean>;
  collapsed: boolean;
  hidden: boolean;
  creating: boolean;
  onToggleSelected: (idx: number, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCreate: () => void;
  onCollapse: (collapsed: boolean) => void;
  onHide: () => void;
  onShow: () => void;
};

export function ChatTaskSuggestions({
  suggestions,
  selected,
  collapsed,
  hidden,
  creating,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onCreate,
  onCollapse,
  onHide,
  onShow,
}: ChatTaskSuggestionsProps) {
  if (!suggestions.length) return null;

  const selectedCount = suggestions.filter((_, idx) => selected[idx] ?? true).length;

  if (hidden) {
    return (
      <div className="flex justify-start pb-2 border-b border-outline-variant/10 mb-2">
        <button
          type="button"
          onClick={onShow}
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1.5 py-1"
        >
          <ListPlus className="h-4 w-4" />
          Show {suggestions.length} suggested tasks
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/10 mb-2">
        <button
          type="button"
          onClick={() => onCollapse(false)}
          className="text-sm font-medium text-on-surface inline-flex items-center gap-1.5 hover:text-primary py-1"
        >
          <ListPlus className="h-4 w-4" />
          {selectedCount}/{suggestions.length} tasks selected
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-200/50 bg-violet-50/40 p-4 sm:p-5 mb-1">
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-sm font-semibold text-violet-950">
          Suggested tasks · {selectedCount}/{suggestions.length}
        </p>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onCollapse(true)}
            aria-label="Collapse suggestions"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onHide} aria-label="Hide suggestions">
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ul className="space-y-0 max-h-52 overflow-y-auto rounded-xl border border-violet-200/30 bg-white/60 divide-y divide-violet-100/80 mb-4">
        {suggestions.map((suggestion, idx) => (
          <li key={`${suggestion.title}-${idx}`}>
            <label className="flex items-start gap-3 py-3.5 px-3 text-base cursor-pointer hover:bg-primary/[0.04]">
              <input
                type="checkbox"
                checked={selected[idx] ?? true}
                onChange={(e) => onToggleSelected(idx, e.target.checked)}
                className="mt-1 h-5 w-5 accent-primary shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-on-surface leading-snug">{suggestion.title}</span>
                {suggestion.description ? (
                  <span className="block text-sm text-on-surface-variant mt-1 line-clamp-2">
                    {suggestion.description}
                  </span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="secondary" size="default" className="h-10 text-sm px-4" onClick={onSelectAll}>
          All
        </Button>
        <Button variant="ghost" size="default" className="h-10 text-sm px-4" onClick={onClearSelection}>
          None
        </Button>
        <Button size="default" className="h-10 text-sm ml-auto px-5" disabled={creating || selectedCount === 0} onClick={onCreate}>
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Add to tasks
        </Button>
      </div>
    </div>
  );
}
