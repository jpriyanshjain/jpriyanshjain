import { Flow } from '../models/Flow.js';
import { FlowExecution } from '../models/FlowExecution.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class FlowManager {
  constructor() {
    this.activeFlows = new Map();
    this.flowCache = new Map();
  }

  async createFlow(flowData) {
    try {
      const { name, description, steps, triggers, version = '1.0.0', createdBy } = flowData;

      // Check if flow with same name exists
      const existingFlow = await Flow.findOne({ name, active: true });
      if (existingFlow) {
        throw new Error(`Flow with name '${name}' already exists`);
      }

      const flow = new Flow({
        id: uuidv4(),
        name,
        description,
        version,
        steps,
        triggers,
        createdBy,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          stepCount: steps.length,
          triggerCount: triggers.length,
          estimatedDuration: this.calculateEstimatedDuration(steps)
        }
      });

      await flow.save();
      
      // Update cache
      this.flowCache.set(flow.id, flow);

      logger.info(`Flow created: ${name} v${version} by ${createdBy}`);
      return flow;

    } catch (error) {
      logger.error('Error creating flow:', error);
      throw error;
    }
  }

  async updateFlow(flowId, updates, updatedBy) {
    try {
      const existingFlow = await Flow.findOne({ id: flowId });
      if (!existingFlow) {
        throw new Error('Flow not found');
      }

      // Create new version
      const versionParts = existingFlow.version.split('.');
      const newVersion = `${versionParts[0]}.${parseInt(versionParts[1]) + 1}.0`;

      // Archive old version
      existingFlow.active = false;
      existingFlow.archivedAt = new Date();
      await existingFlow.save();

      // Create new version
      const newFlow = new Flow({
        id: flowId, // Keep same ID for continuity
        name: existingFlow.name,
        description: updates.description || existingFlow.description,
        version: newVersion,
        steps: updates.steps || existingFlow.steps,
        triggers: updates.triggers || existingFlow.triggers,
        createdBy: existingFlow.createdBy,
        updatedBy,
        active: true,
        createdAt: existingFlow.createdAt,
        updatedAt: new Date(),
        parentVersion: existingFlow.version,
        metadata: {
          stepCount: (updates.steps || existingFlow.steps).length,
          triggerCount: (updates.triggers || existingFlow.triggers).length,
          estimatedDuration: this.calculateEstimatedDuration(updates.steps || existingFlow.steps),
          changeLog: updates.changeLog || 'Flow updated'
        }
      });

      await newFlow.save();

      // Update cache
      this.flowCache.set(flowId, newFlow);

      logger.info(`Flow updated: ${newFlow.name} v${newVersion} by ${updatedBy}`);
      return newFlow;

    } catch (error) {
      logger.error('Error updating flow:', error);
      throw error;
    }
  }

  async getFlow(flowId, version = null) {
    try {
      // Check cache first
      if (!version && this.flowCache.has(flowId)) {
        const cached = this.flowCache.get(flowId);
        if (cached.active) {
          return cached;
        }
      }

      const query = { id: flowId };
      if (version) {
        query.version = version;
      } else {
        query.active = true;
      }

      const flow = await Flow.findOne(query);
      
      if (flow && !version) {
        this.flowCache.set(flowId, flow);
      }

      return flow;

    } catch (error) {
      logger.error('Error getting flow:', error);
      return null;
    }
  }

  async triggerFlow(sessionId, triggerName, context = {}) {
    try {
      // Find flows that match the trigger
      const flows = await Flow.find({
        'triggers.name': triggerName,
        active: true
      });

      if (flows.length === 0) {
        logger.warn(`No active flows found for trigger: ${triggerName}`);
        return null;
      }

      // For now, use the first matching flow
      // In future, we can add logic to select best matching flow
      const flow = flows[0];

      // Check if flow is already active for this session
      if (this.activeFlows.has(sessionId)) {
        const activeFlow = this.activeFlows.get(sessionId);
        if (!activeFlow.completed) {
          logger.warn(`Flow already active for session ${sessionId}`);
          return activeFlow;
        }
      }

      // Create flow execution
      const execution = await this.createFlowExecution(sessionId, flow, context);

      // Store in active flows
      this.activeFlows.set(sessionId, execution);

      logger.info(`Flow triggered: ${flow.name} for session ${sessionId}`);
      return execution;

    } catch (error) {
      logger.error('Error triggering flow:', error);
      return null;
    }
  }

  async createFlowExecution(sessionId, flow, context) {
    try {
      const execution = new FlowExecution({
        id: uuidv4(),
        sessionId,
        flowId: flow.id,
        flowVersion: flow.version,
        status: 'active',
        currentStep: 0,
        stepData: {},
        context,
        startedAt: new Date(),
        metadata: {
          flowName: flow.name,
          totalSteps: flow.steps.length
        }
      });

      await execution.save();
      return execution;

    } catch (error) {
      logger.error('Error creating flow execution:', error);
      throw error;
    }
  }

  async processFlowStep(sessionId, userInput, classification) {
    try {
      const execution = this.activeFlows.get(sessionId) || 
                       await FlowExecution.findOne({ sessionId, status: 'active' });

      if (!execution) {
        logger.warn(`No active flow execution found for session ${sessionId}`);
        return null;
      }

      const flow = await this.getFlow(execution.flowId, execution.flowVersion);
      if (!flow) {
        logger.error(`Flow not found: ${execution.flowId} v${execution.flowVersion}`);
        return null;
      }

      const currentStep = flow.steps[execution.currentStep];
      if (!currentStep) {
        logger.error(`Invalid step index: ${execution.currentStep}`);
        return this.completeFlow(execution);
      }

      // Process current step
      const stepResult = await this.executeStep(currentStep, userInput, classification, execution);

      // Update execution
      execution.stepData[execution.currentStep] = {
        stepId: currentStep.id,
        userInput,
        result: stepResult,
        timestamp: new Date()
      };

      // Determine next step
      const nextStepIndex = this.determineNextStep(currentStep, stepResult, execution);

      if (nextStepIndex === -1 || nextStepIndex >= flow.steps.length) {
        // Flow completed
        return this.completeFlow(execution);
      } else {
        // Move to next step
        execution.currentStep = nextStepIndex;
        execution.updatedAt = new Date();
        await execution.save();

        // Update active flows cache
        this.activeFlows.set(sessionId, execution);

        const nextStep = flow.steps[nextStepIndex];
        return {
          content: this.generateStepResponse(nextStep, stepResult, execution),
          type: 'flow_step',
          flowId: flow.id,
          stepId: nextStep.id,
          stepIndex: nextStepIndex,
          totalSteps: flow.steps.length,
          flowCompleted: false,
          context: {
            flowName: flow.name,
            stepData: execution.stepData
          }
        };
      }

    } catch (error) {
      logger.error('Error processing flow step:', error);
      return {
        content: "I encountered an error processing your request. Let me connect you with a sales representative.",
        type: 'flow_error',
        flowCompleted: true,
        escalateToSales: true
      };
    }
  }

  async executeStep(step, userInput, classification, execution) {
    try {
      switch (step.type) {
        case 'question':
          return this.executeQuestionStep(step, userInput, classification);
        
        case 'condition':
          return this.executeConditionStep(step, userInput, classification, execution);
        
        case 'action':
          return this.executeActionStep(step, userInput, execution);
        
        case 'data_collection':
          return this.executeDataCollectionStep(step, userInput, classification, execution);
        
        case 'property_search':
          return this.executePropertySearchStep(step, userInput, classification);
        
        default:
          logger.warn(`Unknown step type: ${step.type}`);
          return { success: false, error: 'Unknown step type' };
      }

    } catch (error) {
      logger.error(`Error executing step ${step.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  executeQuestionStep(step, userInput, classification) {
    // Simple question step - just collect the response
    return {
      success: true,
      response: userInput,
      intent: classification.intent,
      entities: classification.entities
    };
  }

  executeConditionStep(step, userInput, classification, execution) {
    // Evaluate condition based on step configuration
    const { condition } = step;
    
    if (condition.type === 'intent_match') {
      const matches = condition.intents.includes(classification.intent);
      return {
        success: true,
        conditionMet: matches,
        matchedIntent: classification.intent
      };
    }
    
    if (condition.type === 'entity_present') {
      const hasEntity = classification.entities && 
                       condition.entities.some(entity => 
                         classification.entities[entity]
                       );
      return {
        success: true,
        conditionMet: hasEntity,
        entities: classification.entities
      };
    }
    
    if (condition.type === 'text_contains') {
      const contains = condition.keywords.some(keyword => 
        userInput.toLowerCase().includes(keyword.toLowerCase())
      );
      return {
        success: true,
        conditionMet: contains,
        userInput
      };
    }
    
    return { success: true, conditionMet: false };
  }

  async executeActionStep(step, userInput, execution) {
    // Execute action based on step configuration
    const { action } = step;
    
    if (action.type === 'send_email') {
      // Placeholder for email sending logic
      return { success: true, action: 'email_sent' };
    }
    
    if (action.type === 'create_lead') {
      // Create lead from collected data
      const leadData = this.extractLeadData(execution.stepData);
      return { success: true, action: 'lead_created', leadData };
    }
    
    if (action.type === 'schedule_callback') {
      // Schedule callback
      return { success: true, action: 'callback_scheduled' };
    }
    
    return { success: true, action: 'completed' };
  }

  executeDataCollectionStep(step, userInput, classification, execution) {
    const { dataType } = step;
    let extractedData = {};
    
    switch (dataType) {
      case 'contact_info':
        extractedData = this.extractContactInfo(userInput, classification.entities);
        break;
      
      case 'property_requirements':
        extractedData = this.extractPropertyRequirements(userInput, classification.entities);
        break;
      
      case 'budget_info':
        extractedData = this.extractBudgetInfo(userInput, classification.entities);
        break;
      
      default:
        extractedData = { raw: userInput };
    }
    
    return {
      success: true,
      dataType,
      extractedData,
      complete: this.isDataCollectionComplete(step, extractedData)
    };
  }

  async executePropertySearchStep(step, userInput, classification) {
    // Use the property service to search
    const PropertyService = (await import('./propertyService.js')).PropertyService;
    const propertyService = new PropertyService();
    
    const properties = await propertyService.searchProperties(classification.entities);
    
    return {
      success: true,
      properties,
      count: properties.length,
      searchCriteria: classification.entities
    };
  }

  determineNextStep(currentStep, stepResult, execution) {
    // Default: go to next step
    let nextStepIndex = execution.currentStep + 1;
    
    // Check for conditional routing
    if (currentStep.routing) {
      for (const route of currentStep.routing) {
        if (this.evaluateRouteCondition(route.condition, stepResult, execution)) {
          if (route.action === 'goto') {
            nextStepIndex = route.stepIndex;
          } else if (route.action === 'end') {
            nextStepIndex = -1;
          } else if (route.action === 'escalate') {
            nextStepIndex = -1;
          }
          break;
        }
      }
    }
    
    return nextStepIndex;
  }

  evaluateRouteCondition(condition, stepResult, execution) {
    switch (condition.type) {
      case 'step_result':
        return stepResult[condition.field] === condition.value;
      
      case 'data_complete':
        return stepResult.complete === true;
      
      case 'property_count':
        return stepResult.count >= condition.minCount;
      
      default:
        return false;
    }
  }

  generateStepResponse(step, previousStepResult, execution) {
    let response = step.message || step.question || 'Please provide more information.';
    
    // Replace placeholders with dynamic content
    if (previousStepResult && previousStepResult.properties) {
      const propertyList = previousStepResult.properties
        .slice(0, 3)
        .map(p => `• ${p.title} - ${p.price}`)
        .join('\\n');
      response = response.replace('{properties}', propertyList);
    }
    
    // Add step context
    if (step.context) {
      response += `\\n\\n${step.context}`;
    }
    
    return response;
  }

  async completeFlow(execution) {
    try {
      execution.status = 'completed';
      execution.completedAt = new Date();
      await execution.save();

      // Remove from active flows
      this.activeFlows.delete(execution.sessionId);

      // Determine if escalation is needed
      const escalateToSales = this.shouldEscalateAfterFlow(execution);

      logger.info(`Flow completed for session ${execution.sessionId}`);

      return {
        content: "Thank you for providing the information. " + 
                (escalateToSales ? "I'm connecting you with a sales representative to assist you further." : 
                 "Is there anything else I can help you with?"),
        type: 'flow_completed',
        flowId: execution.flowId,
        flowCompleted: true,
        escalateToSales,
        context: {
          collectedData: execution.stepData,
          flowName: execution.metadata.flowName
        }
      };

    } catch (error) {
      logger.error('Error completing flow:', error);
      throw error;
    }
  }

  shouldEscalateAfterFlow(execution) {
    // Check if collected data indicates need for sales escalation
    const stepData = execution.stepData;
    
    // Check for high-value requirements
    for (const [stepIndex, data] of Object.entries(stepData)) {
      if (data.result && data.result.extractedData) {
        const extracted = data.result.extractedData;
        
        // High budget indicates sales escalation
        if (extracted.budget && extracted.budget.max > 100000) {
          return true;
        }
        
        // Complex requirements indicate sales escalation
        if (extracted.requirements && extracted.requirements.length > 3) {
          return true;
        }
        
        // Specific requests for visits or negotiations
        if (data.result.intent === 'schedule_visit' || data.result.intent === 'negotiation') {
          return true;
        }
      }
    }
    
    return false;
  }

  // Helper methods for data extraction
  extractContactInfo(userInput, entities) {
    const contactInfo = {};
    
    // Extract phone numbers
    const phoneRegex = /(\+91|0)?[\s-]?[6-9]\d{9}/g;
    const phones = userInput.match(phoneRegex);
    if (phones) {
      contactInfo.phone = phones[0];
    }
    
    // Extract email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = userInput.match(emailRegex);
    if (emails) {
      contactInfo.email = emails[0];
    }
    
    // Extract name (simple heuristic)
    const nameRegex = /(?:my name is|i am|i'm)\s+([a-zA-Z\s]+)/i;
    const nameMatch = userInput.match(nameRegex);
    if (nameMatch) {
      contactInfo.name = nameMatch[1].trim();
    }
    
    return contactInfo;
  }

  extractPropertyRequirements(userInput, entities) {
    return {
      propertyTypes: entities.propertyTypes || [],
      locations: entities.locations || [],
      budget: entities.budget || {},
      requirements: entities.requirements || []
    };
  }

  extractBudgetInfo(userInput, entities) {
    return entities.budget || {};
  }

  isDataCollectionComplete(step, extractedData) {
    if (!step.requiredFields) return true;
    
    return step.requiredFields.every(field => 
      extractedData[field] && extractedData[field] !== ''
    );
  }

  extractLeadData(stepData) {
    const leadData = {};
    
    for (const [stepIndex, data] of Object.entries(stepData)) {
      if (data.result && data.result.extractedData) {
        Object.assign(leadData, data.result.extractedData);
      }
    }
    
    return leadData;
  }

  calculateEstimatedDuration(steps) {
    // Rough estimate: 30 seconds per step
    return steps.length * 30;
  }

  async getActiveFlow(sessionId) {
    return this.activeFlows.get(sessionId) || 
           await FlowExecution.findOne({ sessionId, status: 'active' });
  }

  // Method to get flow analytics
  async getFlowAnalytics(flowId, timeRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      const executions = await FlowExecution.find({
        flowId,
        startedAt: { $gte: startDate }
      });

      const analytics = {
        totalExecutions: executions.length,
        completedExecutions: executions.filter(e => e.status === 'completed').length,
        averageDuration: 0,
        dropoffPoints: {},
        completionRate: 0
      };

      if (executions.length > 0) {
        const completedExecutions = executions.filter(e => e.status === 'completed');
        
        if (completedExecutions.length > 0) {
          const totalDuration = completedExecutions.reduce((sum, e) => {
            return sum + (e.completedAt - e.startedAt);
          }, 0);
          
          analytics.averageDuration = totalDuration / completedExecutions.length;
        }
        
        analytics.completionRate = (completedExecutions.length / executions.length) * 100;
        
        // Calculate dropoff points
        executions.forEach(execution => {
          if (execution.status !== 'completed') {
            const dropoffStep = execution.currentStep;
            analytics.dropoffPoints[dropoffStep] = (analytics.dropoffPoints[dropoffStep] || 0) + 1;
          }
        });
      }

      return analytics;

    } catch (error) {
      logger.error('Error getting flow analytics:', error);
      return null;
    }
  }
}