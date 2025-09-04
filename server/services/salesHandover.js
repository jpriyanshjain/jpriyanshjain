import axios from 'axios';
import { logger } from '../utils/logger.js';
import { SalesLead } from '../models/SalesLead.js';
import { v4 as uuidv4 } from 'uuid';

export class SalesHandover {
  constructor() {
    this.salesWebhookUrl = process.env.SALES_WEBHOOK_URL;
    this.salesApiKey = process.env.SALES_API_KEY;
    this.pendingHandovers = new Map();
  }

  async initiate(sessionId, context) {
    try {
      const handoverId = uuidv4();
      const { message, classification, sessionContext } = context;

      // Extract relevant information for sales team
      const leadInfo = this.extractLeadInfo(message, classification, sessionContext);

      // Create sales lead record
      const salesLead = await this.createSalesLead(handoverId, sessionId, leadInfo);

      // Notify sales team
      await this.notifySalesTeam(salesLead);

      // Store pending handover
      this.pendingHandovers.set(sessionId, {
        handoverId,
        timestamp: new Date(),
        status: 'pending',
        leadInfo
      });

      logger.info(`Sales handover initiated for session ${sessionId}, handover ID: ${handoverId}`);

      return {
        content: this.generateHandoverMessage(classification.intent, leadInfo),
        type: 'sales_handover',
        handoverId,
        estimatedWaitTime: this.getEstimatedWaitTime(),
        context: {
          escalated: true,
          reason: classification.intent,
          leadInfo: leadInfo
        }
      };

    } catch (error) {
      logger.error('Error initiating sales handover:', error);
      return {
        content: "I'm connecting you with our sales team. Please hold on while I transfer your conversation.",
        type: 'sales_handover_fallback',
        context: { error: true }
      };
    }
  }

  extractLeadInfo(message, classification, sessionContext) {
    const leadInfo = {
      originalMessage: message,
      intent: classification.intent,
      confidence: classification.confidence,
      entities: classification.entities || {},
      conversationSummary: this.generateConversationSummary(sessionContext.messages || []),
      urgency: this.assessUrgency(classification.intent, message),
      preferredContact: this.extractContactPreference(message),
      requirements: this.extractRequirements(message, classification.entities)
    };

    // Add specific extractions based on intent
    switch (classification.intent) {
      case 'schedule_visit':
        leadInfo.requestType = 'property_visit';
        leadInfo.timeframe = this.extractTimeframe(message);
        break;
      
      case 'negotiation':
        leadInfo.requestType = 'price_negotiation';
        leadInfo.budgetInfo = classification.entities.budget;
        break;
      
      case 'documentation':
        leadInfo.requestType = 'documentation_help';
        leadInfo.documentType = this.extractDocumentType(message);
        break;
      
      case 'complaint':
        leadInfo.requestType = 'complaint_resolution';
        leadInfo.urgency = 'high';
        break;
      
      case 'complex_requirement':
        leadInfo.requestType = 'custom_requirement';
        leadInfo.complexity = 'high';
        break;
    }

    return leadInfo;
  }

  generateConversationSummary(messages) {
    if (!messages || messages.length === 0) return 'No previous conversation';

    const userMessages = messages.filter(msg => msg.sender === 'user');
    if (userMessages.length === 0) return 'No user messages found';

    // Get last few user messages for context
    const recentMessages = userMessages.slice(-3).map(msg => msg.content).join(' | ');
    
    return `Recent conversation: ${recentMessages}`;
  }

  assessUrgency(intent, message) {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'today', 'now', 'emergency'];
    const messageText = message.toLowerCase();
    
    if (intent === 'complaint' || urgentKeywords.some(keyword => messageText.includes(keyword))) {
      return 'high';
    } else if (intent === 'schedule_visit' || intent === 'negotiation') {
      return 'medium';
    }
    
    return 'low';
  }

  extractContactPreference(message) {
    const phoneKeywords = ['call', 'phone', 'speak', 'talk'];
    const emailKeywords = ['email', 'mail', 'send'];
    const whatsappKeywords = ['whatsapp', 'message', 'text'];
    
    const messageText = message.toLowerCase();
    
    if (phoneKeywords.some(keyword => messageText.includes(keyword))) {
      return 'phone';
    } else if (whatsappKeywords.some(keyword => messageText.includes(keyword))) {
      return 'whatsapp';
    } else if (emailKeywords.some(keyword => messageText.includes(keyword))) {
      return 'email';
    }
    
    return 'any';
  }

  extractRequirements(message, entities) {
    const requirements = [];
    
    if (entities.propertyTypes) {
      requirements.push(`Property type: ${entities.propertyTypes.join(', ')}`);
    }
    
    if (entities.locations) {
      requirements.push(`Preferred locations: ${entities.locations.join(', ')}`);
    }
    
    if (entities.budget) {
      const budgetStr = entities.budget.min && entities.budget.max 
        ? `₹${entities.budget.min} - ₹${entities.budget.max}`
        : entities.budget.min 
        ? `Above ₹${entities.budget.min}`
        : entities.budget.max 
        ? `Below ₹${entities.budget.max}`
        : 'Budget mentioned';
      requirements.push(`Budget: ${budgetStr}`);
    }
    
    return requirements;
  }

  extractTimeframe(message) {
    const timeframes = {
      'today': 'today',
      'tomorrow': 'tomorrow',
      'this week': 'this_week',
      'next week': 'next_week',
      'weekend': 'weekend',
      'asap': 'asap',
      'urgent': 'urgent'
    };
    
    const messageText = message.toLowerCase();
    
    for (const [keyword, timeframe] of Object.entries(timeframes)) {
      if (messageText.includes(keyword)) {
        return timeframe;
      }
    }
    
    return 'flexible';
  }

  extractDocumentType(message) {
    const docTypes = {
      'agreement': 'rental_agreement',
      'contract': 'purchase_contract',
      'loan': 'loan_documents',
      'mortgage': 'mortgage_documents',
      'registration': 'registration_documents',
      'legal': 'legal_documents'
    };
    
    const messageText = message.toLowerCase();
    
    for (const [keyword, docType] of Object.entries(docTypes)) {
      if (messageText.includes(keyword)) {
        return docType;
      }
    }
    
    return 'general';
  }

  async createSalesLead(handoverId, sessionId, leadInfo) {
    try {
      const salesLead = new SalesLead({
        handoverId,
        sessionId,
        intent: leadInfo.intent,
        urgency: leadInfo.urgency,
        requirements: leadInfo.requirements,
        conversationSummary: leadInfo.conversationSummary,
        entities: leadInfo.entities,
        preferredContact: leadInfo.preferredContact,
        status: 'pending_assignment',
        createdAt: new Date(),
        metadata: {
          originalMessage: leadInfo.originalMessage,
          confidence: leadInfo.confidence,
          requestType: leadInfo.requestType
        }
      });

      await salesLead.save();
      return salesLead;

    } catch (error) {
      logger.error('Error creating sales lead:', error);
      // Return minimal lead object for fallback
      return {
        handoverId,
        sessionId,
        intent: leadInfo.intent,
        urgency: leadInfo.urgency,
        status: 'pending_assignment'
      };
    }
  }

  async notifySalesTeam(salesLead) {
    try {
      if (!this.salesWebhookUrl) {
        logger.warn('Sales webhook URL not configured, skipping notification');
        return;
      }

      const notification = {
        type: 'new_lead',
        handoverId: salesLead.handoverId,
        sessionId: salesLead.sessionId,
        urgency: salesLead.urgency,
        intent: salesLead.intent,
        requirements: salesLead.requirements,
        conversationSummary: salesLead.conversationSummary,
        preferredContact: salesLead.preferredContact,
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(this.salesWebhookUrl, notification, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.salesApiKey}`,
          'X-Source': 'custom-chatbot'
        },
        timeout: 5000
      });

      logger.info(`Sales team notified successfully for handover ${salesLead.handoverId}`);
      return response.data;

    } catch (error) {
      logger.error('Error notifying sales team:', error);
      // Don't throw error, as handover can still proceed without notification
    }
  }

  generateHandoverMessage(intent, leadInfo) {
    const baseMessage = "I'm connecting you with one of our sales representatives who can better assist you.";
    
    const intentMessages = {
      'schedule_visit': `${baseMessage} They'll help you schedule a property visit at your convenience.`,
      'negotiation': `${baseMessage} They'll discuss pricing options and help you get the best deal.`,
      'documentation': `${baseMessage} They'll guide you through all the necessary documentation and legal processes.`,
      'complaint': `${baseMessage} They'll address your concerns and work to resolve any issues immediately.`,
      'complex_requirement': `${baseMessage} They'll work with you to understand your specific needs and find the perfect solution.`
    };

    const message = intentMessages[intent] || baseMessage;
    const waitTime = this.getEstimatedWaitTime();
    
    return `${message} Estimated wait time: ${waitTime}. Please stay connected.`;
  }

  getEstimatedWaitTime() {
    const hour = new Date().getHours();
    
    // Business hours: 9 AM to 9 PM
    if (hour >= 9 && hour < 21) {
      return '2-5 minutes';
    } else {
      return '15-30 minutes';
    }
  }

  // Method to update handover status
  async updateHandoverStatus(sessionId, status, agentInfo = null) {
    try {
      const handover = this.pendingHandovers.get(sessionId);
      if (handover) {
        handover.status = status;
        handover.updatedAt = new Date();
        
        if (agentInfo) {
          handover.assignedAgent = agentInfo;
        }
      }

      // Update database record
      await SalesLead.findOneAndUpdate(
        { sessionId },
        { 
          status, 
          assignedAgent: agentInfo,
          updatedAt: new Date()
        }
      );

      logger.info(`Handover status updated for session ${sessionId}: ${status}`);

    } catch (error) {
      logger.error('Error updating handover status:', error);
    }
  }

  // Method to get handover status
  getHandoverStatus(sessionId) {
    return this.pendingHandovers.get(sessionId) || null;
  }

  // Method to complete handover
  async completeHandover(sessionId) {
    try {
      this.pendingHandovers.delete(sessionId);
      
      await SalesLead.findOneAndUpdate(
        { sessionId },
        { 
          status: 'completed',
          completedAt: new Date()
        }
      );

      logger.info(`Handover completed for session ${sessionId}`);

    } catch (error) {
      logger.error('Error completing handover:', error);
    }
  }
}