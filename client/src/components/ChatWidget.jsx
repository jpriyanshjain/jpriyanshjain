import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { ChatService } from '../services/chatService';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import SuggestionButtons from './SuggestionButtons';
import PropertyCard from './PropertyCard';

const ChatWidget = ({ 
  apiUrl = 'http://localhost:3000/api',
  position = 'bottom-right',
  theme = 'light',
  initialMessage = "Hello! How can I help you find the perfect property today?",
  suggestions = ["I'm looking for a property", "Show me featured properties", "Help me find a 2BHK apartment"]
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentSuggestions, setCurrentSuggestions] = useState(suggestions);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const chatService = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize chat service
    chatService.current = new ChatService(apiUrl);
    
    // Set up socket event listeners
    chatService.current.onMessage((message) => {
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
      
      if (message.suggestions) {
        setCurrentSuggestions(message.suggestions);
      }
      
      // Handle escalation to sales
      if (message.escalateToSales) {
        setMessages(prev => [...prev, {
          id: `system_${Date.now()}`,
          content: "You're being connected to our sales team. Please hold on...",
          sender: 'system',
          timestamp: new Date(),
          type: 'system_message'
        }]);
      }
      
      // Update unread count if widget is closed
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    chatService.current.onTyping(() => {
      setIsTyping(true);
    });

    chatService.current.onConnect(() => {
      setIsConnected(true);
    });

    chatService.current.onDisconnect(() => {
      setIsConnected(false);
    });

    return () => {
      if (chatService.current) {
        chatService.current.disconnect();
      }
    };
  }, [apiUrl, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenChat = async () => {
    setIsOpen(true);
    setUnreadCount(0);
    
    if (!sessionId) {
      try {
        const session = await chatService.current.initializeSession();
        setSessionId(session.sessionId);
        
        // Add initial message
        setMessages([{
          id: 'initial',
          content: session.message || initialMessage,
          sender: 'ai',
          timestamp: new Date(),
          suggestions: session.suggestions || suggestions
        }]);
        
        setCurrentSuggestions(session.suggestions || suggestions);
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setMessages([{
          id: 'error',
          content: 'Sorry, I\'m having trouble connecting. Please try again.',
          sender: 'system',
          timestamp: new Date(),
          type: 'error'
        }]);
      }
    }
  };

  const handleCloseChat = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleSendMessage = async (message) => {
    if (!message.trim() || !sessionId) return;

    // Add user message immediately
    const userMessage = {
      id: `user_${Date.now()}`,
      content: message,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      await chatService.current.sendMessage(sessionId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsTyping(false);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        content: 'Sorry, I couldn\'t process your message. Please try again.',
        sender: 'system',
        timestamp: new Date(),
        type: 'error'
      }]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const renderMessage = (message) => {
    if (message.type === 'property_list' && message.properties) {
      return (
        <div key={message.id} className="space-y-3">
          <div className="text-sm text-gray-600 mb-2">{message.content}</div>
          {message.properties.map((property, index) => (
            <PropertyCard key={index} property={property} />
          ))}
        </div>
      );
    }

    return (
      <div
        key={message.id}
        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            message.sender === 'user'
              ? 'bg-primary-500 text-white'
              : message.type === 'error'
              ? 'bg-red-100 text-red-800 border border-red-200'
              : message.type === 'system_message'
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              : 'bg-white text-gray-800 border border-gray-200'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <div className="text-xs opacity-70 mt-1">
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>
    );
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  if (!isOpen) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <button
          onClick={handleOpenChat}
          className="relative bg-primary-500 hover:bg-primary-600 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {!isConnected && (
            <span className="absolute -top-1 -right-1 bg-orange-500 rounded-full h-3 w-3"></span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <div 
        className={`bg-white rounded-lg shadow-2xl border border-gray-200 transition-all duration-300 ${
          isMinimized 
            ? 'w-80 h-16' 
            : 'w-80 h-96 sm:w-96 sm:h-[500px]'
        } animate-slide-up`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-primary-500 text-white rounded-t-lg">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-orange-400'}`}></div>
            <h3 className="font-semibold">Property Assistant</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-primary-600 p-1 rounded transition-colors"
              aria-label={isMinimized ? "Maximize chat" : "Minimize chat"}
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button
              onClick={handleCloseChat}
              className="hover:bg-primary-600 p-1 rounded transition-colors"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-messages bg-chat-bg" style={{ height: 'calc(100% - 120px)' }}>
              <MessageList messages={messages} renderMessage={renderMessage} />
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {currentSuggestions.length > 0 && (
              <div className="px-4 pb-2">
                <SuggestionButtons
                  suggestions={currentSuggestions}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
            )}

            {/* Input */}
            <div className="border-t border-gray-200 p-4">
              <MessageInput
                onSendMessage={handleSendMessage}
                disabled={!isConnected || !sessionId}
                placeholder={!isConnected ? "Connecting..." : "Type your message..."}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatWidget;