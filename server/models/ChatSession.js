import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'ai', 'system', 'sales_agent'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['message', 'ai_response', 'flow_step', 'sales_handover', 'system_message', 'error'],
    default: 'message'
  },
  responseTime: {
    type: Number, // in milliseconds
    default: 0
  },
  classification: {
    intent: String,
    confidence: Number,
    entities: mongoose.Schema.Types.Mixed,
    shouldHandleWithAI: Boolean,
    shouldEscalateToSales: Boolean
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  messages: [messageSchema],
  status: {
    type: String,
    enum: ['active', 'ended', 'escalated', 'paused'],
    default: 'active'
  },
  escalatedToSales: {
    type: Boolean,
    default: false
  },
  aiHandled: {
    type: Boolean,
    default: true
  },
  salesAgentId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  endedAt: {
    type: Date
  },
  endReason: {
    type: String,
    enum: ['completed', 'abandoned', 'escalated', 'timeout']
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    source: String,
    tags: [String],
    customFields: mongoose.Schema.Types.Mixed
  },
  analytics: {
    messageCount: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    totalDuration: {
      type: Number,
      default: 0
    },
    intentsDetected: [String],
    escalationReason: String
  }
});

// Indexes for better performance
chatSessionSchema.index({ createdAt: -1 });
chatSessionSchema.index({ lastActivity: -1 });
chatSessionSchema.index({ status: 1, createdAt: -1 });
chatSessionSchema.index({ escalatedToSales: 1, createdAt: -1 });

// Pre-save middleware to update analytics
chatSessionSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.analytics.messageCount = this.messages.length;
    
    const aiMessages = this.messages.filter(m => m.sender === 'ai' && m.responseTime > 0);
    if (aiMessages.length > 0) {
      const totalResponseTime = aiMessages.reduce((sum, m) => sum + m.responseTime, 0);
      this.analytics.averageResponseTime = totalResponseTime / aiMessages.length;
    }
    
    if (this.createdAt) {
      this.analytics.totalDuration = Date.now() - this.createdAt.getTime();
    }
    
    // Extract unique intents
    const intents = this.messages
      .filter(m => m.classification && m.classification.intent)
      .map(m => m.classification.intent);
    this.analytics.intentsDetected = [...new Set(intents)];
  }
  
  next();
});

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);