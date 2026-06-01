import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatRowModel, CursorState } from "./chat-types";

export interface UseChatMessagesOptions<TMessage> {
  initialMessages: readonly TMessage[] | (() => readonly TMessage[]);
  getMessageKey: (message: TMessage) => number | string;
  initialCursor?: CursorState;
  initialLastReadMessageId?: number | string | null;
}

export interface UseChatMessagesReturn<TMessage> {
  rows: ChatRowModel<TMessage>[];
  hasPrevious: boolean;
  hasNext: boolean;
  lastReadMessageId: number | string | null;

  setMessages: (messages: readonly TMessage[], cursor?: CursorState) => void;
  prepend: (messages: readonly TMessage[], cursor?: CursorState) => void;
  append: (messages: readonly TMessage[], cursor?: CursorState) => void;
  send: (message: TMessage) => void;
  patch: (messages: readonly TMessage[]) => void;
  markMessageRead: (messageId: number | string) => void;
}

interface ChatMessagesWindowState<TMessage> {
  messages: TMessage[];
  hasPrevious: boolean;
  hasNext: boolean;
  lastReadMessageId: number | string | null;
}

const resolveInitialMessages = <TMessage,>(
  initialMessages: readonly TMessage[] | (() => readonly TMessage[]),
) =>
  Array.from(
    typeof initialMessages === "function"
      ? initialMessages()
      : initialMessages,
  );

export function useChatMessages<TMessage>({
  initialMessages,
  getMessageKey,
  initialCursor,
  initialLastReadMessageId = null,
}: UseChatMessagesOptions<TMessage>): UseChatMessagesReturn<TMessage> {
  const [windowState, setWindowState] = useState<
    ChatMessagesWindowState<TMessage>
  >(() => ({
    messages: resolveInitialMessages(initialMessages),
    hasPrevious: initialCursor?.hasPrevious ?? false,
    hasNext: initialCursor?.hasNext ?? false,
    lastReadMessageId: initialLastReadMessageId,
  }));
  const getMessageKeyRef = useRef(getMessageKey);

  useEffect(() => {
    getMessageKeyRef.current = getMessageKey;
  }, [getMessageKey]);

  const setMessages = useCallback(
    (messages: readonly TMessage[], cursor?: CursorState) => {
      setWindowState((currentState) => ({
        messages: Array.from(messages),
        hasPrevious: cursor?.hasPrevious ?? currentState.hasPrevious,
        hasNext: cursor?.hasNext ?? currentState.hasNext,
        lastReadMessageId: currentState.lastReadMessageId,
      }));
    },
    [],
  );

  const prepend = useCallback(
    (messages: readonly TMessage[], cursor?: CursorState) => {
      setWindowState((currentState) => ({
        ...currentState,
        messages: [...messages, ...currentState.messages],
        hasPrevious: cursor?.hasPrevious ?? currentState.hasPrevious,
        hasNext: cursor?.hasNext ?? currentState.hasNext,
      }));
    },
    [],
  );

  const append = useCallback(
    (messages: readonly TMessage[], cursor?: CursorState) => {
      setWindowState((currentState) => ({
        ...currentState,
        messages: [...currentState.messages, ...messages],
        hasPrevious: cursor?.hasPrevious ?? currentState.hasPrevious,
        hasNext: cursor?.hasNext ?? false,
      }));
    },
    [],
  );

  const send = useCallback(
    (message: TMessage) => {
      const resolveMessageKey = getMessageKeyRef.current;
      setWindowState((currentState) => ({
        ...currentState,
        messages: [...currentState.messages, message],
        hasNext: false,
        lastReadMessageId: resolveMessageKey(message),
      }));
    },
    [],
  );

  const patch = useCallback((messages: readonly TMessage[]) => {
    if (messages.length === 0) return;

    setWindowState((currentState) => {
      const resolveMessageKey = getMessageKeyRef.current;
      const patchesByKey = new Map(
        messages.map((message) => [resolveMessageKey(message), message]),
      );
      let changed = false;
      const patchedMessages = currentState.messages.map((message) => {
        const patchedMessage = patchesByKey.get(resolveMessageKey(message));
        if (patchedMessage === undefined || patchedMessage === message) {
          return message;
        }

        changed = true;
        return patchedMessage;
      });

      if (!changed) return currentState;

      return {
        ...currentState,
        messages: patchedMessages,
      };
    });
  }, []);

  const markMessageRead = useCallback(
    (messageId: number | string) => {
      setWindowState((currentState) => ({
        ...currentState,
        lastReadMessageId: messageId,
      }));
    },
    [],
  );

  const rows = useMemo(() => {
    const result: ChatRowModel<TMessage>[] = [];
    const { lastReadMessageId } = windowState;
    let insertedNewDivider = false;

    if (windowState.hasPrevious) {
      result.push({
        type: "previous-loading",
        key: "chat-row:previous-loading",
      });
    }

    windowState.messages.forEach((message, messageIndex) => {
      const messageKey = getMessageKey(message) ?? messageIndex;

      if (
        lastReadMessageId !== null &&
        lastReadMessageId !== undefined &&
        !insertedNewDivider &&
        messageKey > lastReadMessageId
      ) {
        insertedNewDivider = true;
        result.push({
          type: "new-divider",
          key: "chat-row:new-divider",
        });
      }

      result.push({
        type: "message",
        key: messageKey,
        messageKey,
        message,
        messageIndex,
      });
    });

    if (windowState.hasNext) {
      result.push({
        type: "next-loading",
        key: "chat-row:next-loading",
      });
    }

    return result;
  }, [windowState, getMessageKey]);

  return {
    rows,
    hasPrevious: windowState.hasPrevious,
    hasNext: windowState.hasNext,
    lastReadMessageId: windowState.lastReadMessageId,
    setMessages,
    prepend,
    append,
    send,
    patch,
    markMessageRead,
  };
}
