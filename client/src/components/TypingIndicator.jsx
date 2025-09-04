import React from 'react';
import { Bot } from 'lucide-react';

const TypingIndicator = () => {
  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="flex-shrink-0 mr-2">
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <Bot size={16} className="text-primary-600" />
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg rounded-bl-sm max-w-xs">
        <div className="flex items-center space-x-1">
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
          <span className="text-sm text-gray-500 ml-2">Typing...</span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;