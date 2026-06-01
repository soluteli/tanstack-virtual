import { useCallback, useEffect, useRef, useState } from "react";

export interface UseMessageHighlightOptions {
  durationMs?: number;
}

export interface UseMessageHighlightReturn {
  highlightedMessageId: number | null;
  highlightMessage: (messageId: number) => void;
}

export function useMessageHighlight({
  durationMs = 1600,
}: UseMessageHighlightOptions = {}): UseMessageHighlightReturn {
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    number | null
  >(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current === null) return;

    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = null;
  }, []);

  const highlightMessage = useCallback(
    (messageId: number) => {
      cancelHighlightTimer();
      setHighlightedMessageId(messageId);
      highlightTimerRef.current = setTimeout(() => {
        highlightTimerRef.current = null;
        setHighlightedMessageId(null);
      }, durationMs);
    },
    [cancelHighlightTimer, durationMs],
  );

  useEffect(
    () => () => {
      cancelHighlightTimer();
    },
    [cancelHighlightTimer],
  );

  return {
    highlightedMessageId,
    highlightMessage,
  };
}
