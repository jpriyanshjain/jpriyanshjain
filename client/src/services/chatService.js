import { io } from 'socket.io-client';
import axios from 'axios';

export class ChatService {
  constructor(apiUrl = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
    this.socket = null;
    this.eventHandlers = {
      message: [],
      typing: [],
      connect: [],
      disconnect: [],
      error: []
    };
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    this.initializeSocket();
  }

  initializeSocket() {
    try {
      this.socket = io(this.apiUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: this.maxReconnectAttempts
      });

      this.socket.on('connect', () => {
        console.log('Connected to chat server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connect');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from chat server:', reason);
        this.isConnected = false;
        this.emit('disconnect', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.reconnectAttempts++;
        this.emit('error', error);
      });

      this.socket.on('receive-message', (message) => {
        this.emit('message', message);
      });

      this.socket.on('typing', () => {
        this.emit('typing');
      });

      this.socket.on('escalate-to-sales', (data) => {
        this.emit('message', {
          ...data,
          escalateToSales: true
        });
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }
  }

  async initializeSession(userId = null, metadata = {}) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/chat/init`, {
        userId,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      if (response.data.success) {
        const sessionData = response.data;
        
        // Join the socket room for this session
        if (this.socket && this.isConnected) {
          this.socket.emit('join-chat', {
            sessionId: sessionData.sessionId,
            userId
          });
        }

        return sessionData;
      } else {
        throw new Error(response.data.error || 'Failed to initialize session');
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      throw error;
    }
  }

  async sendMessage(sessionId, message, metadata = {}) {
    if (!sessionId || !message.trim()) {
      throw new Error('Session ID and message are required');
    }

    try {
      // Send via socket for real-time response
      if (this.socket && this.isConnected) {
        this.socket.emit('send-message', {
          sessionId,
          message: message.trim(),
          metadata,
          timestamp: new Date().toISOString()
        });
      } else {
        // Fallback to HTTP if socket is not connected
        const response = await axios.post(`${this.apiUrl}/api/chat/message`, {
          sessionId,
          message: message.trim(),
          metadata
        });

        if (response.data.success) {
          // Manually emit the response since we're not using socket
          this.emit('message', response.data);
        } else {
          throw new Error(response.data.error || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getChatHistory(sessionId, limit = 50, offset = 0) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/api/chat/history/${sessionId}?limit=${limit}&offset=${offset}`
      );

      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.error || 'Failed to get chat history');
      }
    } catch (error) {
      console.error('Failed to get chat history:', error);
      throw error;
    }
  }

  async endSession(sessionId, reason = 'completed', feedback = null) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/chat/end`, {
        sessionId,
        reason,
        feedback
      });

      return response.data;
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }

  async getSessionStats(sessionId) {
    try {
      const response = await axios.get(`${this.apiUrl}/api/chat/stats/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get session stats:', error);
      throw error;
    }
  }

  // Event handling methods
  onMessage(callback) {
    this.eventHandlers.message.push(callback);
  }

  onTyping(callback) {
    this.eventHandlers.typing.push(callback);
  }

  onConnect(callback) {
    this.eventHandlers.connect.push(callback);
  }

  onDisconnect(callback) {
    this.eventHandlers.disconnect.push(callback);
  }

  onError(callback) {
    this.eventHandlers.error.push(callback);
  }

  emit(event, data = null) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }

  // Utility methods
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.initializeSocket();
    }
  }

  // Streaming methods for real-time responses
  async streamMessage(sessionId, message, onChunk, onComplete, onError) {
    try {
      const response = await fetch(`${this.apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: message.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                onChunk(data);
              } else if (data.type === 'complete') {
                onComplete(data);
              } else if (data.type === 'error') {
                onError(new Error(data.error));
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in streaming message:', error);
      onError(error);
    }
  }
}