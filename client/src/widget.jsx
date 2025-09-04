import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/ChatWidget';
import './styles/index.css';

// Get configuration from window object (set by the website)
const config = window.ChatWidgetConfig || {};

// Create root element if it doesn't exist
let rootElement = document.getElementById('chat-widget-root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'chat-widget-root';
  document.body.appendChild(rootElement);
}

// Initialize the chat widget
const root = ReactDOM.createRoot(rootElement);

root.render(
  <ChatWidget
    apiUrl={config.apiUrl || 'http://localhost:3000'}
    position={config.position || 'bottom-right'}
    theme={config.theme || 'light'}
    primaryColor={config.primaryColor || '#3b82f6'}
    initialMessage={config.initialMessage}
    suggestions={config.suggestions}
    companyName={config.companyName || 'Property Assistant'}
    enableVoice={config.enableVoice !== false}
    enableFileUpload={config.enableFileUpload !== false}
    maxMessageLength={config.maxMessageLength || 500}
    showTypingIndicator={config.showTypingIndicator !== false}
    showResponseTime={config.showResponseTime === true}
    autoOpen={config.autoOpen === true}
    welcomeDelay={config.welcomeDelay || 3000}
  />
);

// Expose global functions for external control
window.ChatWidget = {
  open: () => {
    // This would need to be implemented with a ref or state management
    console.log('ChatWidget.open() called');
  },
  close: () => {
    console.log('ChatWidget.close() called');
  },
  sendMessage: (message) => {
    console.log('ChatWidget.sendMessage() called:', message);
  },
  getStatus: () => {
    return {
      isOpen: false, // This would come from actual state
      isConnected: false,
      sessionId: null
    };
  }
};