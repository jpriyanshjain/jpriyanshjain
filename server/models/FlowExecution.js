import mongoose from 'mongoose';

const flowExecutionSchema = new mongoose.Schema({
  id: {
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
  flowId: {
    type: String,
    required: true,
    index: true
  },
  flowVersion: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'abandoned', 'paused'],
    default: 'active',
    index: true
  },
  currentStep: {
    type: Number,
    default: 0
  },
  stepData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  pausedAt: {
    type: Date
  },
  resumedAt: {
    type: Date
  },
  error: {
    message: String,
    stack: String,
    step: Number,
    timestamp: Date
  },
  metadata: {
    flowName: String,
    totalSteps: Number,
    userId: String,
    userAgent: String,
    ipAddress: String,
    source: String
  },
  analytics: {
    stepTimings: [{
      stepIndex: Number,
      stepId: String,
      startTime: Date,
      endTime: Date,
      duration: Number,
      userInput: String,
      result: mongoose.Schema.Types.Mixed
    }],
    totalDuration: {
      type: Number,
      default: 0
    },
    averageStepTime: {
      type: Number,
      default: 0
    },
    dropoffStep: Number,
    completionPercentage: {
      type: Number,
      default: 0
    }
  }
});

// Indexes for performance
flowExecutionSchema.index({ sessionId: 1, status: 1 });
flowExecutionSchema.index({ flowId: 1, startedAt: -1 });
flowExecutionSchema.index({ status: 1, startedAt: -1 });
flowExecutionSchema.index({ completedAt: -1 });

// Pre-save middleware to update analytics
flowExecutionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update completion percentage
  if (this.metadata.totalSteps > 0) {
    this.analytics.completionPercentage = (this.currentStep / this.metadata.totalSteps) * 100;
  }
  
  // Calculate total duration
  if (this.startedAt) {
    const endTime = this.completedAt || this.failedAt || new Date();
    this.analytics.totalDuration = endTime.getTime() - this.startedAt.getTime();
  }
  
  // Calculate average step time
  if (this.analytics.stepTimings && this.analytics.stepTimings.length > 0) {
    const totalStepTime = this.analytics.stepTimings.reduce((sum, timing) => {
      return sum + (timing.duration || 0);
    }, 0);
    this.analytics.averageStepTime = totalStepTime / this.analytics.stepTimings.length;
  }
  
  // Set dropoff step if failed or abandoned
  if ((this.status === 'failed' || this.status === 'abandoned') && !this.analytics.dropoffStep) {
    this.analytics.dropoffStep = this.currentStep;
  }
  
  next();
});

// Instance methods
flowExecutionSchema.methods.addStepTiming = function(stepIndex, stepId, startTime, endTime, userInput, result) {
  const timing = {
    stepIndex,
    stepId,
    startTime,
    endTime,
    duration: endTime.getTime() - startTime.getTime(),
    userInput,
    result
  };
  
  this.analytics.stepTimings.push(timing);
  return this.save();
};

flowExecutionSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.analytics.completionPercentage = 100;
  return this.save();
};

flowExecutionSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.error = {
    message: error.message,
    stack: error.stack,
    step: this.currentStep,
    timestamp: new Date()
  };
  return this.save();
};

flowExecutionSchema.methods.pause = function() {
  this.status = 'paused';
  this.pausedAt = new Date();
  return this.save();
};

flowExecutionSchema.methods.resume = function() {
  this.status = 'active';
  this.resumedAt = new Date();
  return this.save();
};

flowExecutionSchema.methods.abandon = function() {
  this.status = 'abandoned';
  this.analytics.dropoffStep = this.currentStep;
  return this.save();
};

// Static methods
flowExecutionSchema.statics.findActiveBySession = function(sessionId) {
  return this.findOne({ sessionId, status: 'active' });
};

flowExecutionSchema.statics.getFlowAnalytics = function(flowId, dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  return this.aggregate([
    {
      $match: {
        flowId,
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalExecutions: { $sum: 1 },
        completedExecutions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        averageDuration: { $avg: '$analytics.totalDuration' },
        averageCompletionPercentage: { $avg: '$analytics.completionPercentage' },
        dropoffPoints: {
          $push: {
            $cond: [
              { $in: ['$status', ['failed', 'abandoned']] },
              '$analytics.dropoffStep',
              null
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalExecutions: 1,
        completedExecutions: 1,
        completionRate: {
          $multiply: [
            { $divide: ['$completedExecutions', '$totalExecutions'] },
            100
          ]
        },
        averageDuration: 1,
        averageCompletionPercentage: 1,
        dropoffPoints: {
          $filter: {
            input: '$dropoffPoints',
            cond: { $ne: ['$$this', null] }
          }
        }
      }
    }
  ]);
};

flowExecutionSchema.statics.getStepAnalytics = function(flowId, stepIndex, dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  return this.aggregate([
    {
      $match: {
        flowId,
        startedAt: { $gte: startDate },
        currentStep: { $gte: stepIndex }
      }
    },
    {
      $unwind: '$analytics.stepTimings'
    },
    {
      $match: {
        'analytics.stepTimings.stepIndex': stepIndex
      }
    },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        averageDuration: { $avg: '$analytics.stepTimings.duration' },
        minDuration: { $min: '$analytics.stepTimings.duration' },
        maxDuration: { $max: '$analytics.stepTimings.duration' }
      }
    }
  ]);
};

export const FlowExecution = mongoose.model('FlowExecution', flowExecutionSchema);