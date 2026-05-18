import { faker } from "@faker-js/faker";
import { randomNumber } from "./mockdata";

export interface ChatMessage {
  uid: string;
  id: number;
  text: string;
  imageUrl?: string;
}

export interface CreateChatServerOptions {
  pageSize?: number;
  totalMessagesCount?: number;
  rangeStart?: number;
  rangeEnd?: number;
  rangeMessages?: ChatMessage[];
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
const DEFAULT_FETCH_DELAY_MS = 2000;

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
  rangeStart,
  rangeEnd,
  rangeMessages,
  latestMessageId,
  fetchDelayMs = DEFAULT_FETCH_DELAY_MS,
}: CreateChatServerOptions = {}) => {
  let currentLatestId = latestMessageId ?? Math.max(totalMessagesCount - 1, -1);

  const safeRangeEnd = Math.max(
    0,
    Math.min(rangeEnd ?? totalMessagesCount, totalMessagesCount),
  );
  const safeRangeStart = Math.max(
    0,
    Math.min(rangeStart ?? Math.max(safeRangeEnd - pageSize, 0), safeRangeEnd),
  );
  const currentRangeMessages =
    rangeMessages !== undefined
      ? Array.from(rangeMessages)
      : createMessages({
          start: safeRangeStart,
          size: safeRangeEnd - safeRangeStart,
        });

  const getOldestMessageId = (messages: readonly ChatMessage[]) =>
    messages[0]?.id;

  const getNewestMessageId = (messages: readonly ChatMessage[]) =>
    messages[messages.length - 1]?.id;

  const hasUpperMessages = (messages: readonly ChatMessage[]) =>
    (getOldestMessageId(messages) ?? 0) > 0;

  const hasBottomMessages = (
    messages: readonly ChatMessage[],
    conversationLatestId = currentLatestId,
  ) =>
    (getNewestMessageId(messages) ?? conversationLatestId) <
    conversationLatestId;

  const getRealtimeMessages = (count: number) => {
    const safeCount = Math.max(0, count);
    const nextMessages = createMessages({
      start: currentLatestId + 1,
      size: safeCount,
    });

    totalMessagesCount += safeCount;
    currentLatestId += safeCount;

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
    conversationLatestId = currentLatestId,
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
      return {
        messages: createMessages({
          start: targetId,
          size: loadedRange.oldestId - targetId,
        }),
        direction: "upper",
        hasUpper: targetId > 0,
        hasBottom: loadedRange.newestId < loadedRange.conversationLatestId,
      };
    }

    return {
      messages: createMessages({
        start: loadedRange.newestId + 1,
        size: targetId - loadedRange.newestId,
      }),
      direction: "bottom",
      hasUpper: loadedRange.oldestId > 0,
      hasBottom: targetId < loadedRange.conversationLatestId,
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
      return currentLatestId;
    },
    get rangeMessages() {
      return currentRangeMessages;
    },
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
