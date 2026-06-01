import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChatMessages } from "./useChatMessages";

interface TestMessage {
  id: string;
  text: string;
}

describe("useChatMessages", () => {
  it("patches messages by the configured message key", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [
          { id: "m-1", text: "before-1" },
          { id: "m-2", text: "before-2" },
        ],
        getMessageKey: (message) => message.id,
      }),
    );

    act(() => {
      result.current.patch([{ id: "m-2", text: "after-2" }]);
    });

    const currentMessages = result.current.rows
      .filter((r): r is typeof r & { type: "message" } => r.type === "message")
      .map((r) => r.message);

    expect(currentMessages).toEqual([
      { id: "m-1", text: "before-1" },
      { id: "m-2", text: "after-2" },
    ]);
  });

  it("keeps patch stable when getMessageKey changes", () => {
    const initialMessages = [{ id: "m-1", text: "before-1" }];
    const { result, rerender } = renderHook(
      ({ getMessageKey }: { getMessageKey: (message: TestMessage) => string }) =>
        useChatMessages<TestMessage>({
          initialMessages,
          getMessageKey,
        }),
      {
        initialProps: {
          getMessageKey: (message: TestMessage) => message.id,
        },
      },
    );

    const initialPatch = result.current.patch;

    rerender({
      getMessageKey: (message: TestMessage) => `${message.id}`,
    });

    expect(result.current.patch).toBe(initialPatch);
  });

  it("send appends message and advances lastReadMessageId", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [{ id: "m-1", text: "hello" }],
        getMessageKey: (message) => message.id,
      }),
    );

    act(() => {
      result.current.send({ id: "m-2", text: "world" });
    });

    const sendMessages = result.current.rows
      .filter((r): r is typeof r & { type: "message" } => r.type === "message")
      .map((r) => r.message);
    expect(sendMessages).toEqual([
      { id: "m-1", text: "hello" },
      { id: "m-2", text: "world" },
    ]);
    expect(result.current.lastReadMessageId).toBe("m-2");
  });

  it("markMessageRead advances lastReadMessageId", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [{ id: "m-1", text: "hello" }],
        getMessageKey: (message) => message.id,
      }),
    );

    act(() => {
      result.current.markMessageRead("m-1");
    });

    expect(result.current.lastReadMessageId).toBe("m-1");
  });

  it("rows include new-divider before first message after lastReadMessageId", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [
          { id: "m-1", text: "old" },
          { id: "m-2", text: "new" },
        ],
        getMessageKey: (message) => message.id,
        initialLastReadMessageId: "m-1",
      }),
    );

    const rowTypes = result.current.rows.map((r) => r.type);
    expect(rowTypes).toEqual(["message", "new-divider", "message"]);
  });

  it("rows do not include new-divider when lastReadMessageId is null", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [
          { id: "m-1", text: "a" },
          { id: "m-2", text: "b" },
        ],
        getMessageKey: (message) => message.id,
      }),
    );

    const rowTypes = result.current.rows.map((r) => r.type);
    expect(rowTypes).toEqual(["message", "message"]);
  });

  it("prepend inserts messages at front with cursor updates", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [{ id: "m-2", text: "two" }],
        getMessageKey: (message) => message.id,
        initialCursor: { hasPrevious: true, hasNext: false },
      }),
    );

    act(() => {
      result.current.prepend([{ id: "m-1", text: "one" }], {
        hasPrevious: false,
      });
    });

    const prependMessages = result.current.rows
      .filter((r): r is typeof r & { type: "message" } => r.type === "message")
      .map((r) => r.message);
    expect(prependMessages).toEqual([
      { id: "m-1", text: "one" },
      { id: "m-2", text: "two" },
    ]);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("append adds messages at end with cursor updates", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [{ id: "m-1", text: "one" }],
        getMessageKey: (message) => message.id,
      }),
    );

    act(() => {
      result.current.append([{ id: "m-2", text: "two" }]);
    });

    const appendMessages = result.current.rows
      .filter((r): r is typeof r & { type: "message" } => r.type === "message")
      .map((r) => r.message);
    expect(appendMessages).toEqual([
      { id: "m-1", text: "one" },
      { id: "m-2", text: "two" },
    ]);
  });

  it("setMessages replaces the message window", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [{ id: "m-1", text: "old" }],
        getMessageKey: (message) => message.id,
      }),
    );

    act(() => {
      result.current.setMessages(
        [{ id: "m-2", text: "new1" }, { id: "m-3", text: "new2" }],
        { hasPrevious: true },
      );
    });

    const setMessagesResult = result.current.rows
      .filter((r): r is typeof r & { type: "message" } => r.type === "message")
      .map((r) => r.message);
    expect(setMessagesResult).toEqual([
      { id: "m-2", text: "new1" },
      { id: "m-3", text: "new2" },
    ]);
    expect(result.current.hasPrevious).toBe(true);
  });

  it("rows include previous-loading and next-loading sentinels", () => {
    const { result } = renderHook(() =>
      useChatMessages<TestMessage>({
        initialMessages: [{ id: "m-1", text: "hello" }],
        getMessageKey: (message) => message.id,
        initialCursor: { hasPrevious: true, hasNext: true },
      }),
    );

    const rowTypes = result.current.rows.map((r) => r.type);
    expect(rowTypes).toEqual([
      "previous-loading",
      "message",
      "next-loading",
    ]);
  });
});
