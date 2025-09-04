import express from 'express';
import { ChatHandler } from '../services/chatHandler.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger, chatLogger } from '../utils/logger.js';

const router = express.Router();
const chatHandler = new ChatHandler();

// Initialize chat session
router.post('/init', asyncHandler(async (req, res) => {
  const { userId, metadata = {} } = req.body;
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Enhanced metadata with request info
  const enhancedMetadata = {
    ...metadata,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    referrer: req.get('Referer'),
    timestamp: new Date().toISOString()
  };

  logger.info(`Chat session initialized: ${sessionId}`, { userId, metadata: enhancedMetadata });

  res.json({
    success: true,
    sessionId,
    message: "Hello! I'm here to help you find the perfect property. How can I assist you today?",
    suggestions: [
      "I'm looking for a property",
      "Show me featured properties",
      "Help me find a 2BHK apartment"
    ]
  });
}));

// Send message
router.post('/message', asyncHandler(async (req, res) => {
  const { sessionId, message, userId, metadata = {} } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({
      success: false,
      error: 'Session ID and message are required'
    });
  }

  const startTime = Date.now();

  try {
    const response = await chatHandler.processMessage({
      sessionId,
      message: message.trim(),
      userId,
      metadata: {
        ...metadata,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    const responseTime = Date.now() - startTime;

    // Log the interaction
    chatLogger.logInteraction(
      sessionId,
      message,
      response.content,
      response.classification,
      responseTime
    );

    res.json({
      success: true,
      ...response,
      responseTime
    });

  } catch (error) {
    chatLogger.logError(sessionId, error, { message, userId });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: "I'm sorry, I encountered an error. Please try again or contact our support team.",
      sessionId,
      timestamp: new Date().toISOString()
    });
  }
}));

// Get chat history
router.get('/history/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const stats = await chatHandler.getSessionStats(sessionId);
  
  if (!stats) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    sessionId,
    stats,
    // Note: Full message history would be retrieved from database
    // This is a placeholder response
    messages: [],
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: stats.messageCount
    }
  });
}));

// End chat session
router.post('/end', asyncHandler(async (req, res) => {
  const { sessionId, reason = 'completed', feedback } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID is required'
    });
  }

  await chatHandler.endSession(sessionId, reason);

  if (feedback) {
    logger.info('Chat feedback received', {
      sessionId,
      feedback,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    message: 'Chat session ended successfully',
    sessionId,
    timestamp: new Date().toISOString()
  });
}));

// Get session statistics
router.get('/stats/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const stats = await chatHandler.getSessionStats(sessionId);

  if (!stats) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    stats
  });
}));

// Stream chat response (for real-time typing effect)
router.post('/stream', asyncHandler(async (req, res) => {
  const { sessionId, message, userId } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({
      success: false,
      error: 'Session ID and message are required'
    });
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // This would implement streaming response from AI
    // For now, we'll send a simple response
    const response = await chatHandler.processMessage({
      sessionId,
      message: message.trim(),
      userId
    });

    // Simulate streaming by sending chunks
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = words.slice(0, i + 1).join(' ');
      res.write(`data: ${JSON.stringify({ 
        type: 'chunk', 
        content: chunk,
        complete: i === words.length - 1
      })}\\n\\n`);
      
      // Small delay to simulate typing
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Send final response data
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      ...response
    })}\\n\\n`);

    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Failed to process message'
    })}\\n\\n`);
    res.end();
  }
}));

// Get active sessions count (for monitoring)
router.get('/active-sessions', asyncHandler(async (req, res) => {
  const count = chatHandler.getActiveSessionsCount();
  
  res.json({
    success: true,
    activeSessionsCount: count,
    timestamp: new Date().toISOString()
  });
}));

// Health check for chat service
router.get('/health', asyncHandler(async (req, res) => {
  const stats = {
    activeSessions: chatHandler.getActiveSessionsCount(),
    intentClassifierStats: chatHandler.intentClassifier.getClassificationStats(),
    aiAgentStats: chatHandler.aiAgent.getCacheStats()
  };

  res.json({
    success: true,
    status: 'healthy',
    stats,
    timestamp: new Date().toISOString()
  });
}));

export default router;