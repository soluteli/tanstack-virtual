# AGENTS.md

## Project Overview

This is a small Vite + React + TypeScript playground for chat timelines built on
`@tanstack/react-virtual`. The main behavior under development is stable
virtualized scrolling for dynamic-height chat messages: loading older messages,
loading newer messages, appending realtime messages, jumping to messages,
restoring position, and showing unread/new-message UI.

## Commands

- Install dependencies with the package manager already used in your workflow.
  This repo currently contains both `package-lock.json` and `pnpm-lock.yaml`, so
  avoid changing lockfiles unless dependency work is part of the task.
- Start the dev server: `npm run dev`
- Build/typecheck: `npm run build`
- Preview a production build: `npm run serve`

There is no dedicated test script at the moment. For code changes, run
`npm run build` before calling the work complete.

## Source Layout

- `src/main.tsx` wires the demo routes.
- `src/hooks/useChatScroll.ts` owns virtualizer behavior, scroll intent,
  anchoring, loading triggers, unread divider row modeling, and message jump
  helpers.
- `src/hooks/useChatMessagesController.ts` owns the message window state and
  transitions such as prepend, append, realtime append, unread count clearing,
  and highlighting.
- `src/examples/*.tsx` are runnable demos for specific chat behaviors.
- `src/utils/createChatServer.ts` provides the mock message source.
- `docs/` contains design notes and terminology. Prefer updating docs when a
  change alters the intended scroll model or public hook behavior.

## Implementation Notes

- Treat scroll behavior as stateful and race-prone. Preserve the existing
  guard/callback patterns that prevent stale async loads from mutating a newer
  message window.
- Keep message identity stable. Use `getMessageKey`/message IDs for virtualizer
  keys and anchors rather than array indexes when preserving position.
- When adding a new virtual row type, update both the row model in
  `useChatScroll.ts` and each demo render path that maps `scroll.virtualRows`.
- For dynamic heights, continue to attach
  `ref={scroll.virtualizer.measureElement}` and `data-index` to measured rows.
- Avoid browser scroll anchoring conflicts in scroll containers; existing demos
  set `overflowAnchor: "none"` where needed.
- Prefer small, composable hook APIs over pushing demo-specific branching into
  shared hooks.

## Style

- Follow the style of the file you are editing. Some files use semicolons and
  double quotes, while others use no semicolons and single quotes.
- Keep TypeScript strict-clean. The repo enables `strict`,
  `noUnusedLocals`, and `noUnusedParameters`.
- Use React function components and hooks. Keep render-time calculations pure
  and memoize only where it supports stable callbacks or meaningful work.
- Keep UI simple and demo-focused unless the task explicitly asks for product
  polish.

## Verification

- Run `npm run lint` for TypeScript checks.
- Run `npm run build` when code changes should also be validated against the
  production Vite build.
