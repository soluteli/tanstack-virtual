import { faker } from "@faker-js/faker";
import { randomNumber } from "./mockdata";

export type ChatMessagesDemoInitialMode = "latest" | "middle";

export interface ChatMessage {
  uid: string;
  id: number;
  text: string;
  imageUrl?: string;
}

export interface CreateChatServerOptions {
  pageSize?: number;
  totalMessagesCount?: number;
  latestMessageId?: number;
  fetchDelayMs?: number;
}

export interface ChatMessagesLoadedRange {
  oldestId: number;
  newestId: number;
  conversationLatestId: number;
}

export interface FetchMessagesAroundResult {
  messages: ChatMessage[];
  direction: "loaded" | "upper" | "bottom";
  hasUpper: boolean;
  hasBottom: boolean;
}

interface CreateMessagesParams {
  size: number;
  start?: number;
  end?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TOTAL_MESSAGES_COUNT = 310;
const DEFAULT_LATEST_MESSAGE_ID = 309;
const DEFAULT_FETCH_DELAY_MS = 5000;

const delay = (duration: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });

const createMessages = ({
  size,
  start,
  end,
}: CreateMessagesParams): ChatMessage[] => {
  if (start !== undefined && end !== undefined) {
    throw new Error("Cannot specify both start and end");
  }

  const count =
    start !== undefined
      ? size
      : end !== undefined
        ? Math.max(Math.min(size, end), 0)
        : size;

  const startIndex = start ?? (end !== undefined ? Math.max(end - size, 0) : 0);

  return new Array(count).fill(true).map((_, i) => ({
    uid: faker.string.uuid(),
    id: startIndex + i,
    text: faker.lorem.sentence(randomNumber(20, 70)),
    imageUrl: faker.image.urlPicsumPhotos({
      width: 40,
      height: randomNumber(10, 100),
    }),
  }));
};

export const createChatServer = ({
  pageSize = DEFAULT_PAGE_SIZE,
  totalMessagesCount = DEFAULT_TOTAL_MESSAGES_COUNT,
  latestMessageId = DEFAULT_LATEST_MESSAGE_ID,
  fetchDelayMs = DEFAULT_FETCH_DELAY_MS,
}: CreateChatServerOptions = {}) => {
  if (latestMessageId !== totalMessagesCount - 1) {
    throw new Error(
      "createChatServer requires latestMessageId to equal totalMessagesCount - 1",
    );
  }

  const getOldestMessageId = (messages: readonly ChatMessage[]) =>
    messages[0]?.id;

  const getNewestMessageId = (messages: readonly ChatMessage[]) =>
    messages[messages.length - 1]?.id;

  const hasUpperMessages = (messages: readonly ChatMessage[]) =>
    (getOldestMessageId(messages) ?? 0) > 0;

  const hasBottomMessages = (
    messages: readonly ChatMessage[],
    conversationLatestId = latestMessageId,
  ) =>
    (getNewestMessageId(messages) ?? conversationLatestId) <
    conversationLatestId;

  function getInitialMessages(
    startIndex: number,
    pageSizeOverride?: number,
  ): ChatMessage[];
  function getInitialMessages(
    mode: ChatMessagesDemoInitialMode,
    pageSizeOverride?: number,
  ): ChatMessage[];
  function getInitialMessages(
    startOrMode: number | ChatMessagesDemoInitialMode,
    pageSizeOverride = pageSize,
  ) {
    if (typeof startOrMode === "number") {
      const start = Math.max(0, Math.min(startOrMode, latestMessageId + 1));
      const size = Math.max(
        0,
        Math.min(pageSizeOverride, latestMessageId - start + 1),
      );

      return createMessages({ start, size });
    }

    if (startOrMode === "middle") {
      const start = Math.max(0, latestMessageId - pageSizeOverride * 3);
      const size = Math.max(
        0,
        Math.min(pageSizeOverride, latestMessageId - start + 1),
      );

      return createMessages({ start, size });
    }

    return createMessages({
      end: latestMessageId + 1,
      size: pageSizeOverride,
    });
  }

  const getLatestMessages = (pageSizeOverride = pageSize) =>
    createMessages({
      end: latestMessageId + 1,
      size: pageSizeOverride,
    });

  const getRealtimeMessages = (count: number) => {
    const safeCount = Math.max(0, count);
    const nextMessages = createMessages({
      start: latestMessageId + 1,
      size: safeCount,
    });

    totalMessagesCount += safeCount;
    latestMessageId += safeCount;

    return nextMessages;
  };

  const fetchPreviousMessages = async (
    oldestId: number,
    pageSizeOverride = pageSize,
  ) => {
    await delay(fetchDelayMs);

    return createMessages({
      end: oldestId,
      size: pageSizeOverride,
    });
  };

  const fetchNextMessages = async (
    newestLoadedId: number,
    conversationLatestId = latestMessageId,
    pageSizeOverride = pageSize,
  ) => {
    await delay(fetchDelayMs);

    const count = Math.min(pageSizeOverride, conversationLatestId - newestLoadedId);
    if (count <= 0) return [];

    return createMessages({
      start: newestLoadedId + 1,
      size: count,
    });
  };

  const fetchMessagesAround = async (
    targetMessageId: number,
    loadedRange: ChatMessagesLoadedRange,
    pageSizeOverride = pageSize,
  ): Promise<FetchMessagesAroundResult> => {
    await delay(fetchDelayMs);

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
      const start = Math.max(0, Math.floor(targetId / pageSizeOverride) * pageSizeOverride);
      const count = loadedRange.oldestId - start;

      return {
        messages: createMessages({ start, size: count }),
        direction: "upper",
        hasUpper: start > 0,
        hasBottom: loadedRange.newestId < loadedRange.conversationLatestId,
      };
    }

    const end = Math.min(
      loadedRange.conversationLatestId + 1,
      Math.ceil((targetId + 1) / pageSizeOverride) * pageSizeOverride,
    );
    const count = end - loadedRange.newestId - 1;

    return {
      messages: createMessages({
        start: loadedRange.newestId + 1,
        size: count,
      }),
      direction: "bottom",
      hasUpper: loadedRange.oldestId > 0,
      hasBottom: end - 1 < loadedRange.conversationLatestId,
    };
  };

  return {
    get pageSize() {
      return pageSize;
    },
    get totalMessagesCount() {
      return totalMessagesCount;
    },
    get latestMessageId() {
      return latestMessageId;
    },
    getInitialMessages,
    getLatestMessages,
    getRealtimeMessages,
    fetchPreviousMessages,
    fetchNextMessages,
    fetchMessagesAround,
    getOldestMessageId,
    getNewestMessageId,
    hasUpperMessages,
    hasBottomMessages,
  };
};
