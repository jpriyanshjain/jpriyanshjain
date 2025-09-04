import React from 'react';
import { Bot, User } from 'lucide-react';

const MessageList = ({ messages, renderMessage }) => {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <Bot size={48} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Start a conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
};

const MessageBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.type === 'system_message' || message.type === 'error';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      {!isUser && !isSystem && (
        <div className="flex-shrink-0 mr-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <Bot size={16} className="text-primary-600" />
          </div>
        </div>
      )}
      
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-primary-500 text-white rounded-br-sm'
            : isSystem
            ? message.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        
        {message.responseTime && (
          <div className="text-xs opacity-70 mt-1">
            Responded in {message.responseTime}ms
          </div>
        )}
        
        <div className="text-xs opacity-70 mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
        
        {message.classification && message.classification.intent && (
          <div className="text-xs opacity-50 mt-1">
            Intent: {message.classification.intent} ({Math.round(message.classification.confidence * 100)}%)
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 ml-2">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <User size={16} className="text-gray-600" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;