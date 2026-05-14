import { useCallback, useMemo, useRef, useState } from "react";
import {
  genMessagesListHistory,
  type MessageWithImage,
} from "../utils/mockdata";

export type InitialMode = "latest" | "middle";

export interface UseChatMessagesControllerOptions {
  initialMode?: InitialMode;
  pageSize?: number;
}

export interface PushMessageOptions {
  countAsNew?: boolean;
}

export interface UseChatMessagesControllerReturn {
  messages: MessageWithImage[];
  hasUpper: boolean;
  hasBottom: boolean;
  newMessageCount: number;
  loadUpper: () => Promise<void>;
  loadBottom: () => Promise<void>;
  pushMessage: (options?: PushMessageOptions) => void;
  pushMessages: (count: number, options?: PushMessageOptions) => void;
  jumpToLatest: () => void;
  clearNewMessageCount: () => void;
}

const DEFAULT_PAGE_SIZE = 20;
const INITIAL_LATEST_ID = 109;

const delay = (duration: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });

const getInitialMessages = (mode: InitialMode, pageSize: number) => {
  if (mode === "middle") {
    const start = Math.max(0, INITIAL_LATEST_ID - pageSize * 3);
    return genMessagesListHistory({ start, size: pageSize });
  }

  return genMessagesListHistory({
    end: INITIAL_LATEST_ID + 1,
    size: pageSize,
  });
};

export function useChatMessagesController({
  initialMode = "latest",
  pageSize = DEFAULT_PAGE_SIZE,
}: UseChatMessagesControllerOptions = {}): UseChatMessagesControllerReturn {
  const [conversationLatestId, setConversationLatestId] =
    useState(INITIAL_LATEST_ID);
  const conversationLatestIdRef = useRef(INITIAL_LATEST_ID);
  const [messages, setMessages] = useState(() =>
    getInitialMessages(initialMode, pageSize),
  );
  const [newMessageCount, setNewMessageCount] = useState(0);
  conversationLatestIdRef.current = conversationLatestId;

  const oldestId = messages[0]?.id ?? 0;
  const newestLoadedId = messages[messages.length - 1]?.id ?? 0;

  const hasUpper = oldestId > 0;
  const hasBottom = newestLoadedId < conversationLatestId;

  const pushGeneratedMessages = useCallback(
    (count: number, options?: PushMessageOptions) => {
      if (count <= 0) return;

      const previousLatestId = conversationLatestIdRef.current;
      const nextMessages = genMessagesListHistory({
        start: previousLatestId + 1,
        size: count,
      });
      const nextLatestId =
        nextMessages[nextMessages.length - 1]?.id ?? previousLatestId;

      conversationLatestIdRef.current = nextLatestId;
      setConversationLatestId(nextLatestId);

      setMessages((currentMessages) => {
        const currentNewestId =
          currentMessages[currentMessages.length - 1]?.id ?? -1;
        if (currentNewestId < previousLatestId) {
          return currentMessages;
        }

        return [...currentMessages, ...nextMessages];
      });

      if (options?.countAsNew) {
        setNewMessageCount((currentCount) => currentCount + count);
      }
    },
    [],
  );

  const loadUpper = useCallback(async () => {
    const startingOldestId = messages[0]?.id;
    if (startingOldestId === undefined || startingOldestId <= 0) {
      return;
    }

    await delay(2000);

    setMessages((currentMessages) => {
      const currentOldestId = currentMessages[0]?.id;
      if (currentOldestId !== startingOldestId) {
        return currentMessages;
      }

      const previousMessages = genMessagesListHistory({
        end: startingOldestId,
        size: pageSize,
      });

      return [...previousMessages, ...currentMessages];
    });
  }, [messages, pageSize]);

  const loadBottom = useCallback(async () => {
    await delay(2000);

    setMessages((currentMessages) => {
      const currentNewestId = currentMessages[currentMessages.length - 1]?.id;
      if (currentNewestId === undefined) {
        return currentMessages;
      }

      const count = Math.min(
        pageSize,
        conversationLatestIdRef.current - currentNewestId,
      );
      if (count <= 0) {
        return currentMessages;
      }

      const nextMessages = genMessagesListHistory({
        start: currentNewestId + 1,
        size: count,
      });

      return [...currentMessages, ...nextMessages];
    });
  }, [pageSize]);

  const jumpToLatest = useCallback(() => {
    setMessages(
      genMessagesListHistory({
        end: conversationLatestIdRef.current + 1,
        size: pageSize,
      }),
    );
    setNewMessageCount(0);
  }, [pageSize]);

  const clearNewMessageCount = useCallback(() => {
    setNewMessageCount(0);
  }, []);

  return useMemo(
    () => ({
      messages,
      hasUpper,
      hasBottom,
      newMessageCount,
      loadUpper,
      loadBottom,
      pushMessage: (options?: PushMessageOptions) => {
        pushGeneratedMessages(1, options);
      },
      pushMessages: pushGeneratedMessages,
      jumpToLatest,
      clearNewMessageCount,
    }),
    [
      clearNewMessageCount,
      hasBottom,
      hasUpper,
      jumpToLatest,
      loadBottom,
      loadUpper,
      messages,
      newMessageCount,
      pushGeneratedMessages,
    ],
  );
}
