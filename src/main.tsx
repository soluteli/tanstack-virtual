import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { ChatMessages } from './examples/ChatMessages'
import { ChatMessagesJumpNoBottomDemo } from './examples/ChatMessagesJumpNoBottomDemo'
import { ChatMessagesNewMessageDivider } from './examples/ChatMessagesNewMessageDivider'
import { ChatMessagesNewMessageToast } from './examples/ChatMessagesNewMessageToast'
import { ChatMessagesRestorePosition } from './examples/ChatMessagesRestorePosition'

import './index.css'

function App() {
  const pathname = location.pathname
  return (
    <div>
      <p>
        These chat demos use TanStack Virtual with <strong>dynamic</strong>{' '}
        message sizes. Each row starts with an estimated height, then the
        virtualizer remeasures it after render so image, text, and history
        loading changes keep the scroll position stable.
      </p>
      <nav>
        <ul>
          <li>
            <a href="/chat">chat: load older messages from the top</a>
          </li>
          <li>
            <a href="/chat-jump-no-bottom">
              chat: jump to a loaded or unloaded message
            </a>
          </li>
          <li>
            <a href="/chat-new-message-toast">
              chat: show a new-message toast when away from bottom
            </a>
          </li>
          <li>
            <a href="/chat-restore-position">
              chat: restore scroll position after re-entry
            </a>
          </li>
          <li>
            <a href="/chat-new-message-divider">
              chat: keep a divider at the first unread message
            </a>
          </li>
        </ul>
      </nav>
      {(() => {
        switch (pathname) {
          case '/chat':
            return <ChatMessages />
          case '/chat-restore-position':
            return <ChatMessagesRestorePosition />
          case '/chat-new-message-toast':
            return <ChatMessagesNewMessageToast />
          case '/chat-new-message-divider':
            return <ChatMessagesNewMessageDivider />
          case '/chat-jump-no-bottom':
            return <ChatMessagesJumpNoBottomDemo />
          default:
            return <div>Not found</div>
        }
      })()}
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is built for production.
        </p>
      ) : null}
    </div>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)
const { StrictMode } = React

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
