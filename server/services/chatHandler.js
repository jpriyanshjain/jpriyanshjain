import { IntentClassifier } from './intentClassifier.js';
import { AIAgent } from './aiAgent.js';
import { SalesHandover } from './salesHandover.js';
import { FlowManager } from './flowManager.js';
import { logger } from '../utils/logger.js';
import { ChatSession } from '../models/ChatSession.js';
import { v4 as uuidv4 } from 'uuid';

export class ChatHandler {
  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.aiAgent = new AIAgent();
    this.salesHandover = new SalesHandover();
    this.flowManager = new FlowManager();
    this.activeSessions = new Map();
  }

  async processMessage(data) {
    const startTime = Date.now();
    
    try {
      const { message, sessionId, userId, metadata = {} } = data;
      
      // Validate input
      if (!message || !message.trim()) {
        return this.createErrorResponse('Message cannot be empty');
      }

      // Get or create session
      const session = await this.getOrCreateSession(sessionId, userId, metadata);
      
      // Classify intent
      const classification = this.intentClassifier.classifyIntent(message);
      
      logger.info(`Intent classified: ${classification.intent} (confidence: ${classification.confidence}) for session ${sessionId}`);
      
      // Update session with classification
      session.messages.push({
        id: uuidv4(),
        content: message,
        sender: 'user',
        timestamp: new Date(),
        classification
      });

      let response;
      let escalateToSales = false;

      // Check if there's an active flow for this session
      const activeFlow = await this.flowManager.getActiveFlow(sessionId);
      
      if (activeFlow && !activeFlow.completed) {
        // Continue with flow
        response = await this.flowManager.processFlowStep(sessionId, message, classification);
        
        if (response.flowCompleted && response.escalateToSales) {
          escalateToSales = true;
        }
      } else if (classification.shouldEscalateToSales) {
        // Direct escalation to sales
        response = await this.salesHandover.initiate(sessionId, {
          message,
          classification,
          sessionContext: session
        });
        escalateToSales = true;
      } else if (classification.shouldHandleWithAI) {
        // Handle with AI agent
        const aiResponse = await this.aiAgent.processMessage(message, {
          sessionId,
          intent: classification.intent,
          entities: classification.entities,
          conversationHistory: session.messages
        });

        response = {
          content: aiResponse.response,
          type: 'ai_response',
          responseTime: aiResponse.responseTime,
          context: aiResponse.context
        };

        // Check if AI response suggests escalation
        if (aiResponse.shouldEscalate) {
          escalateToSales = true;
        }
      } else {
        // Fallback response
        response = {
          content: "I understand you're looking for assistance. Let me connect you with one of our sales representatives who can better help you with your specific needs.",
          type: 'fallback',
          responseTime: 0
        };
        escalateToSales = true;
      }

      // Add response to session
      const responseMessage = {
        id: uuidv4(),
        content: response.content,
        sender: escalateToSales ? 'system' : 'ai',
        timestamp: new Date(),
        type: response.type,
        responseTime: response.responseTime || Date.now() - startTime
      };

      session.messages.push(responseMessage);
      session.lastActivity = new Date();

      // Save session to database
      await this.saveSession(session);

      // Update active sessions cache
      this.activeSessions.set(sessionId, session);

      const totalResponseTime = Date.now() - startTime;

      logger.info(`Message processed in ${totalResponseTime}ms for session ${sessionId}`);

      return {
        id: responseMessage.id,
        content: response.content,
        type: response.type,
        sender: responseMessage.sender,
        timestamp: responseMessage.timestamp,
        sessionId,
        classification,
        escalateToSales,
        responseTime: totalResponseTime,
        context: response.context || {},
        suggestions: this.generateSuggestions(classification.intent, response.context)
      };

    } catch (error) {
      logger.error('Error processing message:', error);
      return this.createErrorResponse('I apologize, but I encountered an error. Please try again or contact our support team.');
    }
  }

  async getOrCreateSession(sessionId, userId, metadata) {
    try {
      // Check cache first
      if (this.activeSessions.has(sessionId)) {
        return this.activeSessions.get(sessionId);
      }

      // Try to find existing session in database
      let session = await ChatSession.findOne({ sessionId }).lean();

      if (!session) {
        // Create new session
        session = {
          sessionId: sessionId || uuidv4(),
          userId,
          messages: [],
          metadata,
          status: 'active',
          createdAt: new Date(),
          lastActivity: new Date(),
          escalatedToSales: false,
          aiHandled: true
        };
      }

      return session;
    } catch (error) {
      logger.error('Error getting/creating session:', error);
      // Return minimal session object
      return {
        sessionId: sessionId || uuidv4(),
        userId,
        messages: [],
        metadata: {},
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date()
      };
    }
  }

  async saveSession(session) {
    try {
      await ChatSession.findOneAndUpdate(
        { sessionId: session.sessionId },
        session,
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error('Error saving session:', error);
    }
  }

  generateSuggestions(intent, context = {}) {
    const suggestions = [];

    switch (intent) {
      case 'property_search':
        suggestions.push(
          'Show me 2BHK apartments',
          'Properties under 50,000',
          'Houses near metro station'
        );
        break;
      
      case 'property_details':
        suggestions.push(
          'What are the amenities?',
          'Is parking available?',
          'Show me floor plans'
        );
        break;
      
      case 'pricing_info':
        suggestions.push(
          'What about maintenance charges?',
          'Any deposit required?',
          'Are there any hidden costs?'
        );
        break;
      
      case 'location_info':
        suggestions.push(
          'How is the connectivity?',
          'Any schools nearby?',
          'Shopping areas around?'
        );
        break;
      
      case 'general_inquiry':
        suggestions.push(
          'I\'m looking for a property',
          'Show me featured properties',
          'Help me find a home'
        );
        break;
      
      default:
        suggestions.push(
          'I need help finding a property',
          'Connect me with sales team',
          'Show me available options'
        );
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  createErrorResponse(message) {
    return {
      id: uuidv4(),
      content: message,
      type: 'error',
      sender: 'system',
      timestamp: new Date(),
      escalateToSales: false,
      responseTime: 0,
      context: {},
      suggestions: ['Try again', 'Contact support', 'Restart conversation']
    };
  }

  // Method to get session statistics
  async getSessionStats(sessionId) {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (!session) return null;

      return {
        sessionId,
        messageCount: session.messages.length,
        duration: new Date() - session.createdAt,
        status: session.status,
        escalatedToSales: session.escalatedToSales,
        aiHandled: session.aiHandled,
        lastActivity: session.lastActivity
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return null;
    }
  }

  // Method to end session
  async endSession(sessionId, reason = 'completed') {
    try {
      const session = await ChatSession.findOne({ sessionId });
      if (session) {
        session.status = 'ended';
        session.endReason = reason;
        session.endedAt = new Date();
        await session.save();
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      
      // Clear AI conversation cache
      this.aiAgent.clearConversation(sessionId);

      logger.info(`Session ${sessionId} ended: ${reason}`);
    } catch (error) {
      logger.error('Error ending session:', error);
    }
  }

  // Method to get active sessions count
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  // Method to cleanup inactive sessions
  cleanupInactiveSessions(maxInactiveTime = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now();
    const inactiveSessions = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity.getTime() > maxInactiveTime) {
        inactiveSessions.push(sessionId);
      }
    }

    inactiveSessions.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
      this.aiAgent.clearConversation(sessionId);
    });

    if (inactiveSessions.length > 0) {
      logger.info(`Cleaned up ${inactiveSessions.length} inactive sessions`);
    }
  }
}