import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  text: string;
  speed?: number;
  /**
   * If true, shows the blinking cursor even after typing is complete.
   * Useful when waiting for more streamed content.
   */
  waitingForMore?: boolean; 
  className?: string;
}

export function Typewriter({ 
  text, 
  speed = 15, 
  waitingForMore = false,
  className 
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    // If the new text is not an extension of the current displayed text (e.g. completely new message),
    // reset the displayed text.
    // However, during streaming, text grows. displayedText grows.
    // If text.length < displayedText.length, it's a reset/deletion.
    // If text doesn't start with displayedText, it's a change.
    if (!text.startsWith(displayedText) && displayedText.length > 0) {
       // Only reset if it's genuinely different content, not just a lagging update
       // For safety in chat apps, if text is shorter, we must reset.
       if (text.length < displayedText.length) {
         // Use setTimeout to defer the state update and avoid synchronous update warning
         const timeoutId = setTimeout(() => {
             setDisplayedText("");
         }, 0);
         return () => clearTimeout(timeoutId);
       }
    }
  }, [text, displayedText]);

  useEffect(() => {
    if (displayedText.length < text.length) {
      const timeout = setTimeout(() => {
        // Add one character at a time
        setDisplayedText((prev) => text.slice(0, prev.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [displayedText, text, speed]);

  // If text was fully reset (empty string passed), sync immediately to avoid stale state issues
  if (text.length === 0 && displayedText.length > 0) {
      setDisplayedText("");
  }

  const isTyping = displayedText.length < text.length;
  const showCursor = isTyping || waitingForMore;

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {displayedText}
      {showCursor && (
        <span className="inline-block w-1.5 h-3 bg-cyan-400 ml-1 animate-pulse align-middle" />
      )}
    </span>
  );
}
