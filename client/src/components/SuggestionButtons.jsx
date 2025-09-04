import React from 'react';

const SuggestionButtons = ({ suggestions, onSuggestionClick }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSuggestionClick(suggestion)}
          className="suggestion-button text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-primary-300 hover:text-primary-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default SuggestionButtons;