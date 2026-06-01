import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatScroll } from "./useChatScroll";
import type { ChatRowModel } from "./chat-types";

describe("useChatScroll", () => {
  let frameCallbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  const flushAnimationFrame = () => {
    const callbacks = Array.from(frameCallbacks.values());
    frameCallbacks.clear();
    callbacks.forEach((callback) => callback(performance.now()));
  };

  beforeEach(() => {
    frameCallbacks = new Map();
    nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      frameCallbacks.delete(frameId);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the initial scroll settled callback scheduled across rerenders", () => {
    const onInitialScrollSettled = vi.fn();
    const rows: ChatRowModel<unknown>[] = [
      { type: "message", key: "message-1", messageKey: "message-1", message: null, messageIndex: 0 },
    ];

    const { rerender } = renderHook(
      ({ renderCount }: { renderCount: number }) => {
        void renderCount;
        return useChatScroll({
          rows,
          getScrollElement: () => null,
          initialScroll: { type: "bottom" },
          onInitialScrollSettled,
        });
      },
      { initialProps: { renderCount: 1 } },
    );

    rerender({ renderCount: 2 });

    act(flushAnimationFrame);
    expect(onInitialScrollSettled).not.toHaveBeenCalled();

    act(flushAnimationFrame);
    expect(onInitialScrollSettled).toHaveBeenCalledTimes(1);
  });
});
