"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const EMOJI_REGEX = /[\p{Extended_Pictographic}\u200D\uFE0F]/gu;

function stripEmojis(value: string): string {
  return value.replace(EMOJI_REGEX, "");
}

type RichTextMessageProps = {
  content: string;
  className?: string;
};

export function RichTextMessage({ content, className }: RichTextMessageProps) {
  const cleaned = stripEmojis(content || "");
  return (
    <div
      className={[
        "leading-relaxed break-words",
        "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-1",
        "[&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.95em]",
        "[&_a]:underline [&_a]:underline-offset-2",
        className ?? "",
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>
    </div>
  );
}
