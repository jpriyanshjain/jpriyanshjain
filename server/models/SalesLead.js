import mongoose from 'mongoose';

const salesLeadSchema = new mongoose.Schema({
  handoverId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  intent: {
    type: String,
    required: true,
    index: true
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['pending_assignment', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending_assignment',
    index: true
  },
  assignedAgent: {
    id: String,
    name: String,
    email: String,
    phone: String,
    assignedAt: Date
  },
  requirements: [String],
  conversationSummary: {
    type: String,
    required: true
  },
  entities: {
    propertyTypes: [String],
    locations: [String],
    budget: {
      min: Number,
      max: Number
    },
    numbers: [Number]
  },
  preferredContact: {
    type: String,
    enum: ['phone', 'email', 'whatsapp', 'any'],
    default: 'any'
  },
  contactInfo: {
    name: String,
    phone: String,
    email: String,
    alternatePhone: String,
    preferredTime: String
  },
  propertyRequirements: {
    type: String,
    size: String,
    budget: String,
    location: String,
    amenities: [String],
    timeline: String,
    purpose: {
      type: String,
      enum: ['buy', 'rent', 'invest', 'commercial']
    }
  },
  followUpActions: [{
    action: {
      type: String,
      enum: ['call', 'email', 'site_visit', 'send_brochure', 'schedule_meeting']
    },
    scheduledAt: Date,
    completedAt: Date,
    notes: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending'
    }
  }],
  notes: [{
    content: String,
    createdBy: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['general', 'call_log', 'meeting_notes', 'follow_up'],
      default: 'general'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  assignedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  metadata: {
    originalMessage: String,
    confidence: Number,
    requestType: String,
    source: String,
    userAgent: String,
    ipAddress: String,
    referrer: String
  },
  analytics: {
    responseTime: Number, // Time to first agent response
    resolutionTime: Number, // Time to completion
    touchPoints: Number, // Number of interactions
    conversionStatus: {
      type: String,
      enum: ['converted', 'not_converted', 'pending'],
      default: 'pending'
    },
    conversionValue: Number,
    satisfaction: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String,
      surveyDate: Date
    }
  }
});

// Indexes for performance
salesLeadSchema.index({ createdAt: -1 });
salesLeadSchema.index({ status: 1, urgency: -1, createdAt: -1 });
salesLeadSchema.index({ 'assignedAgent.id': 1, status: 1 });
salesLeadSchema.index({ intent: 1, createdAt: -1 });

// Pre-save middleware
salesLeadSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate analytics
  if (this.assignedAt && this.createdAt) {
    this.analytics.responseTime = this.assignedAt.getTime() - this.createdAt.getTime();
  }
  
  if (this.completedAt && this.createdAt) {
    this.analytics.resolutionTime = this.completedAt.getTime() - this.createdAt.getTime();
  }
  
  if (this.notes) {
    this.analytics.touchPoints = this.notes.length;
  }
  
  next();
});

// Instance methods
salesLeadSchema.methods.assignToAgent = function(agentInfo) {
  this.status = 'assigned';
  this.assignedAgent = {
    ...agentInfo,
    assignedAt: new Date()
  };
  this.assignedAt = new Date();
  return this.save();
};

salesLeadSchema.methods.addNote = function(content, createdBy, type = 'general') {
  this.notes.push({
    content,
    createdBy,
    type,
    createdAt: new Date()
  });
  return this.save();
};

salesLeadSchema.methods.addFollowUpAction = function(action, scheduledAt, notes = '') {
  this.followUpActions.push({
    action,
    scheduledAt,
    notes,
    status: 'pending'
  });
  return this.save();
};

salesLeadSchema.methods.completeFollowUpAction = function(actionIndex, notes = '') {
  if (this.followUpActions[actionIndex]) {
    this.followUpActions[actionIndex].status = 'completed';
    this.followUpActions[actionIndex].completedAt = new Date();
    if (notes) {
      this.followUpActions[actionIndex].notes += ` | Completed: ${notes}`;
    }
  }
  return this.save();
};

salesLeadSchema.methods.markCompleted = function(conversionStatus = 'pending', conversionValue = 0) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.analytics.conversionStatus = conversionStatus;
  this.analytics.conversionValue = conversionValue;
  return this.save();
};

salesLeadSchema.methods.cancel = function(reason = '') {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  if (reason) {
    this.addNote(`Lead cancelled: ${reason}`, 'system', 'general');
  }
  return this.save();
};

salesLeadSchema.methods.updateContactInfo = function(contactInfo) {
  this.contactInfo = { ...this.contactInfo, ...contactInfo };
  return this.save();
};

salesLeadSchema.methods.updatePropertyRequirements = function(requirements) {
  this.propertyRequirements = { ...this.propertyRequirements, ...requirements };
  return this.save();
};

// Static methods
salesLeadSchema.statics.findPendingByUrgency = function() {
  return this.find({ status: 'pending_assignment' })
    .sort({ urgency: -1, createdAt: 1 });
};

salesLeadSchema.statics.findByAgent = function(agentId, status = null) {
  const query = { 'assignedAgent.id': agentId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

salesLeadSchema.statics.getLeadAnalytics = function(dateRange = 30, agentId = null) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  const matchQuery = { createdAt: { $gte: startDate } };
  if (agentId) {
    matchQuery['assignedAgent.id'] = agentId;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        pendingLeads: {
          $sum: { $cond: [{ $eq: ['$status', 'pending_assignment'] }, 1, 0] }
        },
        assignedLeads: {
          $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
        },
        completedLeads: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        convertedLeads: {
          $sum: { $cond: [{ $eq: ['$analytics.conversionStatus', 'converted'] }, 1, 0] }
        },
        averageResponseTime: { $avg: '$analytics.responseTime' },
        averageResolutionTime: { $avg: '$analytics.resolutionTime' },
        totalConversionValue: { $sum: '$analytics.conversionValue' },
        urgencyBreakdown: {
          $push: '$urgency'
        },
        intentBreakdown: {
          $push: '$intent'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalLeads: 1,
        pendingLeads: 1,
        assignedLeads: 1,
        completedLeads: 1,
        convertedLeads: 1,
        conversionRate: {
          $multiply: [
            { $divide: ['$convertedLeads', '$completedLeads'] },
            100
          ]
        },
        completionRate: {
          $multiply: [
            { $divide: ['$completedLeads', '$totalLeads'] },
            100
          ]
        },
        averageResponseTime: 1,
        averageResolutionTime: 1,
        totalConversionValue: 1,
        urgencyBreakdown: 1,
        intentBreakdown: 1
      }
    }
  ]);
};

export const SalesLead = mongoose.model('SalesLead', salesLeadSchema);