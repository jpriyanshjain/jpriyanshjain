import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { PropertyService } from './propertyService.js';

export class AIAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.propertyService = new PropertyService();
    this.conversationCache = new Map();
    this.systemPrompt = this.buildSystemPrompt();
  }

  buildSystemPrompt() {
    return `You are a helpful and knowledgeable real estate assistant. Your role is to:

1. Help users find properties based on their requirements
2. Provide detailed information about properties
3. Answer questions about locations, amenities, and pricing
4. Recommend suitable properties based on user preferences
5. Collect user requirements in a conversational manner

Guidelines:
- Be friendly, professional, and helpful
- Ask clarifying questions when user requirements are unclear
- Provide specific property recommendations when possible
- If you need to schedule visits, negotiate prices, handle complaints, or deal with complex custom requirements, politely inform the user that you'll connect them with a sales agent
- Keep responses concise but informative
- Use bullet points for listing features or options
- Always be honest about property availability and pricing

When recommending properties, include:
- Property type and size
- Location and nearby amenities
- Price range
- Key features
- Contact information for more details

If you cannot find suitable properties or need more specific information, ask relevant follow-up questions to better understand the user's needs.`;
  }

  async processMessage(message, context = {}) {
    try {
      const startTime = Date.now();
      
      // Get conversation history
      const conversationId = context.sessionId || 'default';
      let conversation = this.conversationCache.get(conversationId) || [];
      
      // Add user message to conversation
      conversation.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Search for relevant properties if intent suggests property search
      let propertyContext = '';
      if (context.intent === 'property_search' && context.entities) {
        const properties = await this.propertyService.searchProperties(context.entities);
        if (properties.length > 0) {
          propertyContext = `\\n\\nRelevant Properties:\\n${this.formatPropertiesForAI(properties)}`;
        }
      }

      // Prepare messages for OpenAI
      const messages = [
        { role: 'system', content: this.systemPrompt + propertyContext },
        ...conversation.slice(-10).map(msg => ({ // Keep last 10 messages for context
          role: msg.role,
          content: msg.content
        }))
      ];

      // Call OpenAI API with optimized parameters for speed
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500, // Limit response length for faster responses
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        stream: false // We'll implement streaming separately if needed
      });

      const aiResponse = completion.choices[0].message.content.trim();
      const responseTime = Date.now() - startTime;

      // Add AI response to conversation
      conversation.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        responseTime
      });

      // Update conversation cache (keep last 20 messages)
      this.conversationCache.set(conversationId, conversation.slice(-20));

      // Check if response suggests escalation
      const shouldEscalate = this.checkForEscalation(aiResponse, message);

      logger.info(`AI response generated in ${responseTime}ms for session ${conversationId}`);

      return {
        response: aiResponse,
        responseTime,
        shouldEscalate,
        context: {
          conversationLength: conversation.length,
          propertiesFound: propertyContext ? true : false
        }
      };

    } catch (error) {
      logger.error('Error in AI agent processing:', error);
      
      // Fallback response
      return {
        response: "I apologize, but I'm experiencing some technical difficulties right now. Let me connect you with one of our sales agents who can assist you better.",
        responseTime: 0,
        shouldEscalate: true,
        error: true
      };
    }
  }

  formatPropertiesForAI(properties) {
    return properties.map(property => {
      return `- ${property.title} (${property.type})
  Location: ${property.location}
  Price: ${property.price}
  Size: ${property.size}
  Features: ${property.features?.join(', ') || 'N/A'}
  Contact: ${property.contact || 'Available on request'}`;
    }).join('\\n\\n');
  }

  checkForEscalation(aiResponse, userMessage) {
    const escalationKeywords = [
      'connect you with', 'sales agent', 'speak with someone',
      'schedule a visit', 'book an appointment', 'negotiate',
      'technical issue', 'cannot help', 'complex requirement'
    ];

    const responseText = aiResponse.toLowerCase();
    return escalationKeywords.some(keyword => responseText.includes(keyword));
  }

  // Method to get conversation history
  getConversationHistory(sessionId) {
    return this.conversationCache.get(sessionId) || [];
  }

  // Method to clear conversation cache
  clearConversation(sessionId) {
    this.conversationCache.delete(sessionId);
  }

  // Method to get cache statistics
  getCacheStats() {
    return {
      activeSessions: this.conversationCache.size,
      totalMessages: Array.from(this.conversationCache.values())
        .reduce((sum, conv) => sum + conv.length, 0)
    };
  }

  // Streaming response method for real-time responses
  async streamResponse(message, context = {}) {
    try {
      const conversationId = context.sessionId || 'default';
      let conversation = this.conversationCache.get(conversationId) || [];
      
      conversation.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversation.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      const stream = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        stream: true
      });

      return stream;

    } catch (error) {
      logger.error('Error in streaming response:', error);
      throw error;
    }
  }
}