import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Date / Time Formatters ── */
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const FR_DAYS = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()].slice(0, 3)}.`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatTimeString(time: string): string {
  return time.slice(0, 5);
}

export function getDayName(iso: string): string {
  const d = new Date(iso);
  return FR_DAYS[d.getDay()];
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/* ── Mood Helpers ── */
const MOOD_LABELS: Record<number, string> = {
  1: "Très bas",
  2: "Bas",
  3: "Neutre",
  4: "Bien",
  5: "Excellent",
};

const MOOD_EMOJIS: Record<number, string> = {
  1: "😔",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😊",
};

export function moodLabel(score: number): string {
  return MOOD_LABELS[score] ?? "Inconnu";
}

export function moodEmoji(score: number): string {
  return MOOD_EMOJIS[score] ?? "❓";
}

/* ── Mode Helpers ── */
const MODE_LABELS: Record<string, string> = {
  REVISION: "Révision",
  EXAMEN: "Examen",
  PROJET: "Projet",
  REPOS: "Repos",
  SPORT: "Sport",
  COURS: "Cours",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function parseOption(raw: string): { value: string; label: string } {
  const trimmed = raw.trim();
  const valueMatch = trimmed.match(/['"]value['"]\s*:\s*['"]([^'"]+)['"]/);
  const labelMatch = trimmed.match(/['"]label['"]\s*:\s*['"]([^'"]+)['"]/);
  if (valueMatch && labelMatch) {
    return { value: valueMatch[1], label: labelMatch[1] };
  }
  return { value: raw, label: raw };
}
