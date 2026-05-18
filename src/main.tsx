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
        These components are using <strong>dynamic</strong> sizes. This means
        that each element's exact dimensions are unknown when rendered. An
        estimated dimension is used as the initial measurement, then this
        measurement is readjusted on the fly as each element is rendered.
      </p>
      <nav>
        <ul>
          <li>
            <a href="/chat">chat with upper loading</a>
          </li>
          <li>
            <a href="/chat-jump">chat jump</a>
          </li>
          <li>
            <a href="/chat-new-message-toast">chat new message notification</a>
          </li>
          <li>
            <a href="/chat-restore-position">chat restore position when re enter</a>
          </li>
          <li>
            <a href="/chat-new-message-divider">chat new message divider</a>
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
