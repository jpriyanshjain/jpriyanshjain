import express from 'express';
import { FlowManager } from '../services/flowManager.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const flowManager = new FlowManager();

// Create new flow
router.post('/', asyncHandler(async (req, res) => {
  const { name, description, steps, triggers, version, createdBy } = req.body;

  if (!name || !steps || !triggers || !createdBy) {
    return res.status(400).json({
      success: false,
      error: 'Name, steps, triggers, and createdBy are required'
    });
  }

  const flow = await flowManager.createFlow({
    name,
    description,
    steps,
    triggers,
    version,
    createdBy
  });

  res.status(201).json({
    success: true,
    flow,
    message: 'Flow created successfully'
  });
}));

// Get all flows
router.get('/', asyncHandler(async (req, res) => {
  const { active = true, limit = 50, offset = 0 } = req.query;
  
  // This would typically use Flow.find() with pagination
  // For now, returning a placeholder response
  res.json({
    success: true,
    flows: [],
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: 0
    }
  });
}));

// Get specific flow
router.get('/:flowId', asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { version } = req.query;

  const flow = await flowManager.getFlow(flowId, version);

  if (!flow) {
    return res.status(404).json({
      success: false,
      error: 'Flow not found'
    });
  }

  res.json({
    success: true,
    flow
  });
}));

// Update flow (creates new version)
router.put('/:flowId', asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { description, steps, triggers, updatedBy, changeLog } = req.body;

  if (!updatedBy) {
    return res.status(400).json({
      success: false,
      error: 'updatedBy is required'
    });
  }

  const updates = {
    description,
    steps,
    triggers,
    changeLog
  };

  const updatedFlow = await flowManager.updateFlow(flowId, updates, updatedBy);

  res.json({
    success: true,
    flow: updatedFlow,
    message: 'Flow updated successfully (new version created)'
  });
}));

// Get flow versions
router.get('/:flowId/versions', asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  
  // This would use Flow.getVersions(flowId)
  res.json({
    success: true,
    versions: [],
    flowId
  });
}));

// Trigger flow manually
router.post('/:flowId/trigger', asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { sessionId, triggerName, context = {} } = req.body;

  if (!sessionId || !triggerName) {
    return res.status(400).json({
      success: false,
      error: 'sessionId and triggerName are required'
    });
  }

  const execution = await flowManager.triggerFlow(sessionId, triggerName, context);

  if (!execution) {
    return res.status(404).json({
      success: false,
      error: 'Flow not found or could not be triggered'
    });
  }

  res.json({
    success: true,
    execution,
    message: 'Flow triggered successfully'
  });
}));

// Get flow analytics
router.get('/:flowId/analytics', asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { timeRange = 30 } = req.query;

  const analytics = await flowManager.getFlowAnalytics(flowId, parseInt(timeRange));

  if (!analytics) {
    return res.status(404).json({
      success: false,
      error: 'Flow not found or no analytics available'
    });
  }

  res.json({
    success: true,
    analytics,
    flowId,
    timeRange: parseInt(timeRange)
  });
}));

// Get active flow executions
router.get('/executions/active', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  // This would query FlowExecution collection
  res.json({
    success: true,
    executions: [],
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: 0
    }
  });
}));

// Get flow execution details
router.get('/executions/:executionId', asyncHandler(async (req, res) => {
  const { executionId } = req.params;
  
  // This would query FlowExecution by ID
  res.json({
    success: true,
    execution: null,
    message: 'Execution not found'
  });
}));

// Create sample flows for testing
router.post('/samples', asyncHandler(async (req, res) => {
  const { createdBy = 'system' } = req.body;

  const sampleFlows = [
    {
      name: 'Property Inquiry Flow',
      description: 'Collects user requirements for property search',
      version: '1.0.0',
      steps: [
        {
          id: 'welcome',
          name: 'Welcome Message',
          type: 'message',
          message: 'Hello! I\'d be happy to help you find the perfect property. Let me ask you a few questions to understand your requirements better.',
          routing: [{ condition: { type: 'always' }, action: 'goto', stepIndex: 1 }]
        },
        {
          id: 'property_type',
          name: 'Property Type Question',
          type: 'question',
          question: 'What type of property are you looking for? (e.g., apartment, house, villa, commercial)',
          dataType: 'property_requirements',
          routing: [{ condition: { type: 'always' }, action: 'goto', stepIndex: 2 }]
        },
        {
          id: 'location_preference',
          name: 'Location Preference',
          type: 'question',
          question: 'Which area or location would you prefer?',
          dataType: 'property_requirements',
          routing: [{ condition: { type: 'always' }, action: 'goto', stepIndex: 3 }]
        },
        {
          id: 'budget_inquiry',
          name: 'Budget Information',
          type: 'question',
          question: 'What\'s your budget range?',
          dataType: 'budget_info',
          routing: [{ condition: { type: 'always' }, action: 'goto', stepIndex: 4 }]
        },
        {
          id: 'property_search',
          name: 'Search Properties',
          type: 'property_search',
          message: 'Based on your requirements, here are some properties I found: {properties}',
          routing: [
            { 
              condition: { type: 'property_count', minCount: 1 }, 
              action: 'goto', 
              stepIndex: 5 
            },
            { 
              condition: { type: 'property_count', minCount: 0 }, 
              action: 'escalate',
              message: 'I couldn\'t find properties matching your exact criteria. Let me connect you with our sales team who can help you with more options.'
            }
          ]
        },
        {
          id: 'next_steps',
          name: 'Next Steps',
          type: 'question',
          question: 'Would you like to schedule a visit to any of these properties, or do you need more information?',
          routing: [
            {
              condition: { type: 'text_contains', keywords: ['visit', 'schedule', 'see'] },
              action: 'escalate',
              message: 'Great! Let me connect you with our sales team to schedule your property visits.'
            },
            {
              condition: { type: 'text_contains', keywords: ['more', 'information', 'details'] },
              action: 'goto',
              stepIndex: 6
            }
          ]
        },
        {
          id: 'additional_info',
          name: 'Additional Information',
          type: 'message',
          message: 'I can provide more details about any specific property. Which one interests you the most?',
          routing: [{ condition: { type: 'always' }, action: 'end' }]
        }
      ],
      triggers: [
        {
          name: 'property_search',
          type: 'intent',
          intents: ['property_search', 'general_inquiry'],
          priority: 1,
          active: true
        }
      ],
      createdBy
    },
    {
      name: 'Lead Qualification Flow',
      description: 'Qualifies leads and collects contact information',
      version: '1.0.0',
      steps: [
        {
          id: 'qualification_start',
          name: 'Qualification Introduction',
          type: 'message',
          message: 'To better assist you, I\'d like to understand your requirements. This will only take a minute.',
          routing: [{ condition: { type: 'always' }, action: 'goto', stepIndex: 1 }]
        },
        {
          id: 'contact_info',
          name: 'Contact Information',
          type: 'data_collection',
          question: 'May I have your name and phone number so our team can reach out to you?',
          dataType: 'contact_info',
          requiredFields: ['name', 'phone'],
          routing: [
            {
              condition: { type: 'data_complete' },
              action: 'goto',
              stepIndex: 2
            },
            {
              condition: { type: 'data_incomplete' },
              action: 'repeat',
              message: 'I need at least your name and phone number to proceed. Could you please provide them?'
            }
          ]
        },
        {
          id: 'timeline',
          name: 'Purchase Timeline',
          type: 'question',
          question: 'When are you planning to make this property decision?',
          routing: [
            {
              condition: { type: 'text_contains', keywords: ['urgent', 'immediately', 'asap', 'this week'] },
              action: 'escalate',
              message: 'Since you\'re looking to move quickly, let me connect you with our senior sales consultant right away.'
            },
            {
              condition: { type: 'always' },
              action: 'goto',
              stepIndex: 3
            }
          ]
        },
        {
          id: 'create_lead',
          name: 'Create Sales Lead',
          type: 'action',
          action: {
            type: 'create_lead',
            config: {}
          },
          message: 'Thank you for the information. Our team will contact you shortly with suitable options.',
          routing: [{ condition: { type: 'always' }, action: 'end' }]
        }
      ],
      triggers: [
        {
          name: 'lead_qualification',
          type: 'intent',
          intents: ['schedule_visit', 'complex_requirement'],
          priority: 2,
          active: true
        }
      ],
      createdBy
    }
  ];

  const createdFlows = [];
  for (const flowData of sampleFlows) {
    try {
      const flow = await flowManager.createFlow(flowData);
      createdFlows.push(flow);
    } catch (error) {
      logger.warn(`Failed to create sample flow: ${flowData.name}`, error);
    }
  }

  res.json({
    success: true,
    message: `Created ${createdFlows.length} sample flows`,
    flows: createdFlows
  });
}));

export default router;