import {
  genMessagesListHistory,
  type MessageWithImage,
} from "./mockdata";

export type ChatMessagesDemoInitialMode = "latest" | "middle";

export const CHAT_MESSAGES_DEMO_PAGE_SIZE = 20;
export const CHAT_MESSAGES_DEMO_INITIAL_LATEST_ID = 309;
export const CHAT_MESSAGES_DEMO_FETCH_DELAY = 5000;

export interface ChatMessagesLoadedRange {
  oldestId: number;
  newestId: number;
  conversationLatestId: number;
}

export interface FetchMessagesAroundResult {
  messages: MessageWithImage[];
  direction: "loaded" | "upper" | "bottom";
  hasUpper: boolean;
  hasBottom: boolean;
}

const delay = (duration: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });

export const getOldestMessageId = (
  messages: readonly MessageWithImage[],
) => messages[0]?.id;

export const getNewestMessageId = (
  messages: readonly MessageWithImage[],
) => messages[messages.length - 1]?.id;

export const hasUpperMessages = (messages: readonly MessageWithImage[]) =>
  (getOldestMessageId(messages) ?? 0) > 0;

export const hasBottomMessages = (
  messages: readonly MessageWithImage[],
  conversationLatestId: number,
) =>
  (getNewestMessageId(messages) ?? conversationLatestId) <
  conversationLatestId;

export const getInitialChatMessages = (
  mode: ChatMessagesDemoInitialMode,
  pageSize = CHAT_MESSAGES_DEMO_PAGE_SIZE,
) => {
  if (mode === "middle") {
    const start = Math.max(
      0,
      CHAT_MESSAGES_DEMO_INITIAL_LATEST_ID - pageSize * 3,
    );
    return genMessagesListHistory({ start, size: pageSize });
  }

  return genMessagesListHistory({
    end: CHAT_MESSAGES_DEMO_INITIAL_LATEST_ID + 1,
    size: pageSize,
  });
};

export const getLatestChatMessages = (
  conversationLatestId: number,
  pageSize = CHAT_MESSAGES_DEMO_PAGE_SIZE,
) =>
  genMessagesListHistory({
    end: conversationLatestId + 1,
    size: pageSize,
  });

export const getRealtimeChatMessages = (
  previousConversationLatestId: number,
  count: number,
) =>
  genMessagesListHistory({
    start: previousConversationLatestId + 1,
    size: count,
  });

export const fetchPreviousChatMessages = async (
  oldestId: number,
  pageSize = CHAT_MESSAGES_DEMO_PAGE_SIZE,
) => {
  await delay(CHAT_MESSAGES_DEMO_FETCH_DELAY);

  return genMessagesListHistory({
    end: oldestId,
    size: pageSize,
  });
};

export const fetchNextChatMessages = async (
  newestLoadedId: number,
  conversationLatestId: number,
  pageSize = CHAT_MESSAGES_DEMO_PAGE_SIZE,
) => {
  await delay(CHAT_MESSAGES_DEMO_FETCH_DELAY);

  const count = Math.min(pageSize, conversationLatestId - newestLoadedId);
  if (count <= 0) return [];

  return genMessagesListHistory({
    start: newestLoadedId + 1,
    size: count,
  });
};

export const fetchMessagesAround = async (
  targetMessageId: number,
  loadedRange: ChatMessagesLoadedRange,
  pageSize = CHAT_MESSAGES_DEMO_PAGE_SIZE,
): Promise<FetchMessagesAroundResult> => {
  await delay(CHAT_MESSAGES_DEMO_FETCH_DELAY);

  const targetId = Math.max(
    0,
    Math.min(targetMessageId, loadedRange.conversationLatestId),
  );

  if (
    targetId >= loadedRange.oldestId &&
    targetId <= loadedRange.newestId
  ) {
    return {
      messages: [],
      direction: "loaded",
      hasUpper: loadedRange.oldestId > 0,
      hasBottom: loadedRange.newestId < loadedRange.conversationLatestId,
    };
  }

  if (targetId < loadedRange.oldestId) {
    const start = Math.max(0, Math.floor(targetId / pageSize) * pageSize);
    const count = loadedRange.oldestId - start;

    return {
      messages: genMessagesListHistory({ start, size: count }),
      direction: "upper",
      hasUpper: start > 0,
      hasBottom: loadedRange.newestId < loadedRange.conversationLatestId,
    };
  }

  const end = Math.min(
    loadedRange.conversationLatestId + 1,
    Math.ceil((targetId + 1) / pageSize) * pageSize,
  );
  const count = end - loadedRange.newestId - 1;

  return {
    messages: genMessagesListHistory({
      start: loadedRange.newestId + 1,
      size: count,
    }),
    direction: "bottom",
    hasUpper: loadedRange.oldestId > 0,
    hasBottom: end - 1 < loadedRange.conversationLatestId,
  };
};
