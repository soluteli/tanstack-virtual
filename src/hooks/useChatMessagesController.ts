import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseChatMessagesControllerOptions<TMessage> {
  initialMessages: readonly TMessage[] | (() => readonly TMessage[]);
  initialHasUpper?: boolean;
  initialHasBottom?: boolean;
  initialNewMessageCount?: number;
  highlightDurationMs?: number;
}

export interface ChatMessagesTransitionOptions<TMessage> {
  hasUpper?: boolean;
  hasBottom?: boolean;
  guard?: (messages: readonly TMessage[]) => boolean;
}

export interface ReplaceChatMessagesWindowOptions {
  hasUpper?: boolean;
  hasBottom?: boolean;
  newMessageCount?: number;
}

export interface AppendRealtimeMessagesOptions<TMessage>
  extends ChatMessagesTransitionOptions<TMessage> {
  countAsNew?: boolean;
  appendToWindow?: boolean;
}

export interface UseChatMessagesControllerReturn<TMessage> {
  messages: TMessage[];
  hasUpper: boolean;
  hasBottom: boolean;
  newMessageCount: number;
  highlightedMessageId: number | null;
  replaceWindow: (
    messages: readonly TMessage[],
    options?: ReplaceChatMessagesWindowOptions,
  ) => void;
  prependMessages: (
    messages: readonly TMessage[],
    options?: ChatMessagesTransitionOptions<TMessage>,
  ) => void;
  appendMessages: (
    messages: readonly TMessage[],
    options?: ChatMessagesTransitionOptions<TMessage>,
  ) => void;
  appendRealtimeMessages: (
    messages: readonly TMessage[],
    options?: AppendRealtimeMessagesOptions<TMessage>,
  ) => void;
  clearNewMessageCount: () => void;
  highlightMessage: (messageId: number) => void;
}

interface ChatMessagesWindowState<TMessage> {
  messages: TMessage[];
  hasUpper: boolean;
  hasBottom: boolean;
  newMessageCount: number;
}

const resolveInitialMessages = <TMessage,>(
  initialMessages: readonly TMessage[] | (() => readonly TMessage[]),
) =>
  Array.from(
    typeof initialMessages === "function"
      ? initialMessages()
      : initialMessages,
  );

const shouldApplyTransition = <TMessage,>(
  messages: readonly TMessage[],
  guard?: (messages: readonly TMessage[]) => boolean,
) => !guard || guard(messages);

export function useChatMessagesController<TMessage>({
  initialMessages,
  initialHasUpper = false,
  initialHasBottom = false,
  initialNewMessageCount = 0,
  highlightDurationMs = 1600,
}: UseChatMessagesControllerOptions<TMessage>): UseChatMessagesControllerReturn<TMessage> {
  const [windowState, setWindowState] = useState<
    ChatMessagesWindowState<TMessage>
  >(() => ({
    messages: resolveInitialMessages(initialMessages),
    hasUpper: initialHasUpper,
    hasBottom: initialHasBottom,
    newMessageCount: initialNewMessageCount,
  }));
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    number | null
  >(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current === null) return;

    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = null;
  }, []);

  const replaceWindow = useCallback(
    (
      messages: readonly TMessage[],
      options?: ReplaceChatMessagesWindowOptions,
    ) => {
      setWindowState((currentState) => ({
        messages: Array.from(messages),
        hasUpper: options?.hasUpper ?? currentState.hasUpper,
        hasBottom: options?.hasBottom ?? currentState.hasBottom,
        newMessageCount:
          options?.newMessageCount ?? currentState.newMessageCount,
      }));
    },
    [],
  );

  const prependMessages = useCallback(
    (
      messages: readonly TMessage[],
      options?: ChatMessagesTransitionOptions<TMessage>,
    ) => {
      setWindowState((currentState) => {
        if (!shouldApplyTransition(currentState.messages, options?.guard)) {
          return currentState;
        }

        return {
          ...currentState,
          messages: [...messages, ...currentState.messages],
          hasUpper: options?.hasUpper ?? currentState.hasUpper,
          hasBottom: options?.hasBottom ?? currentState.hasBottom,
        };
      });
    },
    [],
  );

  const appendMessages = useCallback(
    (
      messages: readonly TMessage[],
      options?: ChatMessagesTransitionOptions<TMessage>,
    ) => {
      setWindowState((currentState) => {
        if (!shouldApplyTransition(currentState.messages, options?.guard)) {
          return currentState;
        }

        return {
          ...currentState,
          messages: [...currentState.messages, ...messages],
          hasUpper: options?.hasUpper ?? currentState.hasUpper,
          hasBottom: options?.hasBottom ?? currentState.hasBottom,
        };
      });
    },
    [],
  );

  const appendRealtimeMessages = useCallback(
    (
      messages: readonly TMessage[],
      options?: AppendRealtimeMessagesOptions<TMessage>,
    ) => {
      setWindowState((currentState) => {
        if (!shouldApplyTransition(currentState.messages, options?.guard)) {
          return currentState;
        }
        const shouldAppend = options?.appendToWindow ?? true;
        const newMessageCount = options?.countAsNew
          ? currentState.newMessageCount + messages.length
          : currentState.newMessageCount;

        return {
          ...currentState,
          messages: shouldAppend
            ? [...currentState.messages, ...messages]
            : currentState.messages,
          hasUpper: options?.hasUpper ?? currentState.hasUpper,
          hasBottom: options?.hasBottom ?? currentState.hasBottom,
          newMessageCount,
        };
      });
    },
    [],
  );

  const clearNewMessageCount = useCallback(() => {
    setWindowState((currentState) => ({
      ...currentState,
      newMessageCount: 0,
    }));
  }, []);

  const highlightMessage = useCallback(
    (messageId: number) => {
      cancelHighlightTimer();
      setHighlightedMessageId(messageId);
      highlightTimerRef.current = setTimeout(() => {
        highlightTimerRef.current = null;
        setHighlightedMessageId(null);
      }, highlightDurationMs);
    },
    [cancelHighlightTimer, highlightDurationMs],
  );

  useEffect(
    () => () => {
      cancelHighlightTimer();
    },
    [cancelHighlightTimer],
  );

  return useMemo(
    () => ({
      messages: windowState.messages,
      hasUpper: windowState.hasUpper,
      hasBottom: windowState.hasBottom,
      newMessageCount: windowState.newMessageCount,
      highlightedMessageId,
      replaceWindow,
      prependMessages,
      appendMessages,
      appendRealtimeMessages,
      clearNewMessageCount,
      highlightMessage,
    }),
    [
      appendMessages,
      appendRealtimeMessages,
      clearNewMessageCount,
      highlightMessage,
      highlightedMessageId,
      prependMessages,
      replaceWindow,
      windowState.hasBottom,
      windowState.hasUpper,
      windowState.messages,
      windowState.newMessageCount,
    ],
  );
}
