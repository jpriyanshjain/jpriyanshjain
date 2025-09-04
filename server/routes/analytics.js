import express from 'express';
import { ChatSession } from '../models/ChatSession.js';
import { SalesLead } from '../models/SalesLead.js';
import { FlowExecution } from '../models/FlowExecution.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get chat analytics
router.get('/chat', asyncHandler(async (req, res) => {
  const { timeRange = 30, groupBy = 'day' } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  const analytics = await ChatSession.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        activeSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        escalatedSessions: {
          $sum: { $cond: ['$escalatedToSales', 1, 0] }
        },
        averageMessages: { $avg: '$analytics.messageCount' },
        averageResponseTime: { $avg: '$analytics.averageResponseTime' },
        averageDuration: { $avg: '$analytics.totalDuration' },
        topIntents: { $push: '$analytics.intentsDetected' }
      }
    },
    {
      $project: {
        _id: 0,
        totalSessions: 1,
        activeSessions: 1,
        escalatedSessions: 1,
        escalationRate: {
          $multiply: [
            { $divide: ['$escalatedSessions', '$totalSessions'] },
            100
          ]
        },
        averageMessages: 1,
        averageResponseTime: 1,
        averageDuration: 1,
        topIntents: 1
      }
    }
  ]);

  // Get session trends by time period
  const trendData = await ChatSession.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupBy === 'hour' ? '%Y-%m-%d-%H' : '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        sessions: { $sum: 1 },
        escalations: {
          $sum: { $cond: ['$escalatedToSales', 1, 0] }
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  res.json({
    success: true,
    analytics: analytics[0] || {},
    trends: trendData,
    timeRange: parseInt(timeRange),
    groupBy
  });
}));

// Get sales analytics
router.get('/sales', asyncHandler(async (req, res) => {
  const { timeRange = 30, agentId } = req.query;
  
  const analytics = await SalesLead.getLeadAnalytics(parseInt(timeRange), agentId);

  res.json({
    success: true,
    analytics: analytics[0] || {},
    timeRange: parseInt(timeRange),
    agentId: agentId || 'all'
  });
}));

// Get flow analytics
router.get('/flows', asyncHandler(async (req, res) => {
  const { timeRange = 30, flowId } = req.query;
  
  let analytics;
  
  if (flowId) {
    analytics = await FlowExecution.getFlowAnalytics(flowId, parseInt(timeRange));
  } else {
    // Get analytics for all flows
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));
    
    analytics = await FlowExecution.aggregate([
      {
        $match: {
          startedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$flowId',
          totalExecutions: { $sum: 1 },
          completedExecutions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageDuration: { $avg: '$analytics.totalDuration' },
          averageCompletionPercentage: { $avg: '$analytics.completionPercentage' }
        }
      },
      {
        $project: {
          flowId: '$_id',
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
          averageCompletionPercentage: 1
        }
      },
      {
        $sort: { totalExecutions: -1 }
      }
    ]);
  }

  res.json({
    success: true,
    analytics: flowId ? (analytics[0] || {}) : analytics,
    timeRange: parseInt(timeRange),
    flowId: flowId || 'all'
  });
}));

// Get performance metrics
router.get('/performance', asyncHandler(async (req, res) => {
  const { timeRange = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  // Response time analytics
  const responseTimeAnalytics = await ChatSession.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $unwind: '$messages'
    },
    {
      $match: {
        'messages.sender': 'ai',
        'messages.responseTime': { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        averageResponseTime: { $avg: '$messages.responseTime' },
        minResponseTime: { $min: '$messages.responseTime' },
        maxResponseTime: { $max: '$messages.responseTime' },
        totalResponses: { $sum: 1 },
        slowResponses: {
          $sum: { $cond: [{ $gt: ['$messages.responseTime', 5000] }, 1, 0] }
        }
      }
    }
  ]);

  // Intent classification accuracy (mock data for now)
  const intentAnalytics = {
    totalClassifications: 1000,
    highConfidenceClassifications: 850,
    mediumConfidenceClassifications: 120,
    lowConfidenceClassifications: 30,
    averageConfidence: 0.82
  };

  res.json({
    success: true,
    responseTime: responseTimeAnalytics[0] || {},
    intentClassification: intentAnalytics,
    timeRange: parseInt(timeRange)
  });
}));

// Get user satisfaction metrics
router.get('/satisfaction', asyncHandler(async (req, res) => {
  const { timeRange = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  // This would typically come from feedback data
  // For now, returning mock data
  const satisfactionMetrics = {
    totalFeedback: 150,
    averageRating: 4.2,
    ratingDistribution: {
      5: 65,
      4: 45,
      3: 25,
      2: 10,
      1: 5
    },
    commonComplaints: [
      'Response too slow',
      'Couldn\'t understand query',
      'Limited property options'
    ],
    commonPraise: [
      'Helpful responses',
      'Quick property search',
      'Easy to use'
    ]
  };

  res.json({
    success: true,
    satisfaction: satisfactionMetrics,
    timeRange: parseInt(timeRange)
  });
}));

// Get real-time metrics
router.get('/realtime', asyncHandler(async (req, res) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const realtimeMetrics = await ChatSession.aggregate([
    {
      $match: {
        lastActivity: { $gte: oneHourAgo }
      }
    },
    {
      $group: {
        _id: null,
        activeSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        newSessions: {
          $sum: { $cond: [{ $gte: ['$createdAt', oneHourAgo] }, 1, 0] }
        },
        escalations: {
          $sum: { $cond: ['$escalatedToSales', 1, 0] }
        }
      }
    }
  ]);

  // Get pending sales leads
  const pendingLeads = await SalesLead.countDocuments({
    status: 'pending_assignment',
    createdAt: { $gte: oneHourAgo }
  });

  res.json({
    success: true,
    realtime: {
      ...(realtimeMetrics[0] || {}),
      pendingLeads,
      timestamp: now.toISOString()
    }
  });
}));

// Export analytics data
router.get('/export', asyncHandler(async (req, res) => {
  const { type, timeRange = 30, format = 'json' } = req.query;
  
  if (!['chat', 'sales', 'flows'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid export type. Must be: chat, sales, or flows'
    });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  let data = [];

  switch (type) {
    case 'chat':
      data = await ChatSession.find({
        createdAt: { $gte: startDate }
      }).select('-messages').lean();
      break;
    
    case 'sales':
      data = await SalesLead.find({
        createdAt: { $gte: startDate }
      }).lean();
      break;
    
    case 'flows':
      data = await FlowExecution.find({
        startedAt: { $gte: startDate }
      }).lean();
      break;
  }

  if (format === 'csv') {
    // Convert to CSV format
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-export.csv`);
    
    // This would implement CSV conversion
    res.send('CSV export not implemented yet');
  } else {
    res.json({
      success: true,
      data,
      count: data.length,
      exportType: type,
      timeRange: parseInt(timeRange),
      exportedAt: new Date().toISOString()
    });
  }
}));

export default router;