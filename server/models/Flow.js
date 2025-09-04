import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['question', 'condition', 'action', 'data_collection', 'property_search', 'message'],
    required: true
  },
  message: String,
  question: String,
  condition: {
    type: {
      type: String,
      enum: ['intent_match', 'entity_present', 'text_contains', 'custom']
    },
    intents: [String],
    entities: [String],
    keywords: [String],
    customLogic: String
  },
  action: {
    type: {
      type: String,
      enum: ['send_email', 'create_lead', 'schedule_callback', 'update_data', 'api_call']
    },
    config: mongoose.Schema.Types.Mixed
  },
  dataType: {
    type: String,
    enum: ['contact_info', 'property_requirements', 'budget_info', 'custom']
  },
  requiredFields: [String],
  validation: {
    type: mongoose.Schema.Types.Mixed
  },
  routing: [{
    condition: {
      type: String,
      field: String,
      value: mongoose.Schema.Types.Mixed
    },
    action: {
      type: String,
      enum: ['goto', 'end', 'escalate', 'repeat']
    },
    stepIndex: Number,
    message: String
  }],
  timeout: {
    type: Number,
    default: 300 // 5 minutes
  },
  retries: {
    type: Number,
    default: 3
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const triggerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['intent', 'keyword', 'event', 'time', 'condition'],
    required: true
  },
  intents: [String],
  keywords: [String],
  event: String,
  condition: mongoose.Schema.Types.Mixed,
  priority: {
    type: Number,
    default: 1
  },
  active: {
    type: Boolean,
    default: true
  }
});

const flowSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  parentVersion: {
    type: String
  },
  steps: [stepSchema],
  triggers: [triggerSchema],
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  published: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: {
    type: Date
  },
  archivedAt: {
    type: Date
  },
  metadata: {
    stepCount: {
      type: Number,
      default: 0
    },
    triggerCount: {
      type: Number,
      default: 0
    },
    estimatedDuration: {
      type: Number,
      default: 0
    },
    category: {
      type: String,
      enum: ['lead_generation', 'support', 'sales', 'onboarding', 'custom'],
      default: 'custom'
    },
    tags: [String],
    changeLog: String,
    testingNotes: String
  },
  analytics: {
    totalExecutions: {
      type: Number,
      default: 0
    },
    successfulExecutions: {
      type: Number,
      default: 0
    },
    averageCompletionTime: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    lastExecuted: Date
  }
});

// Compound indexes for better query performance
flowSchema.index({ name: 1, active: 1 });
flowSchema.index({ 'triggers.name': 1, active: 1 });
flowSchema.index({ createdBy: 1, active: 1 });
flowSchema.index({ version: 1, active: 1 });

// Pre-save middleware
flowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.steps) {
    this.metadata.stepCount = this.steps.length;
  }
  
  if (this.triggers) {
    this.metadata.triggerCount = this.triggers.length;
  }
  
  next();
});

// Methods
flowSchema.methods.getActiveSteps = function() {
  return this.steps.filter(step => step.active !== false);
};

flowSchema.methods.getActiveTriggers = function() {
  return this.triggers.filter(trigger => trigger.active !== false);
};

flowSchema.methods.clone = function(newVersion, updatedBy) {
  const cloned = new this.constructor(this.toObject());
  cloned._id = mongoose.Types.ObjectId();
  cloned.version = newVersion;
  cloned.updatedBy = updatedBy;
  cloned.parentVersion = this.version;
  cloned.createdAt = new Date();
  cloned.updatedAt = new Date();
  cloned.publishedAt = null;
  cloned.published = false;
  
  return cloned;
};

// Static methods
flowSchema.statics.findByTrigger = function(triggerName) {
  return this.find({
    'triggers.name': triggerName,
    'triggers.active': true,
    active: true
  }).sort({ 'triggers.priority': -1 });
};

flowSchema.statics.getVersions = function(flowId) {
  return this.find({ id: flowId }).sort({ createdAt: -1 });
};

export const Flow = mongoose.model('Flow', flowSchema);