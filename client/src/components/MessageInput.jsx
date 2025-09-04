import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';

const MessageInput = ({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message...",
  maxLength = 500 
}) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        const audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          // Here you would typically send the audio to a speech-to-text service
          console.log('Audio recorded:', audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Handle file upload - you might want to upload to your server
      console.log('File selected:', file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end space-x-2">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          rows={1}
          style={{ minHeight: '40px', maxHeight: '100px' }}
        />
        
        {/* Character count */}
        {message.length > maxLength * 0.8 && (
          <div className="absolute bottom-1 right-16 text-xs text-gray-400">
            {message.length}/{maxLength}
          </div>
        )}
        
        {/* File upload and voice recording buttons */}
        <div className="absolute right-2 bottom-2 flex space-x-1">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx"
          />
          <label
            htmlFor="file-upload"
            className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
            title="Attach file"
          >
            <Paperclip size={16} />
          </label>
          
          <button
            type="button"
            onClick={handleVoiceRecording}
            className={`p-1 transition-colors ${
              isRecording 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title={isRecording ? "Stop recording" : "Start voice recording"}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
      </div>
      
      <button
        type="submit"
        disabled={!message.trim() || disabled}
        className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        title="Send message"
      >
        <Send size={16} />
      </button>
    </form>
  );
};

export default MessageInput;