import natural from 'natural';
import { logger } from '../utils/logger.js';

export class IntentClassifier {
  constructor() {
    this.classifier = new natural.BayesClassifier();
    this.isTrained = false;
    this.intentPatterns = {
      // AI-handleable intents
      'property_search': [
        'looking for property', 'find property', 'search property', 'property available',
        'what properties', 'show me properties', 'property listings', 'apartments for rent',
        'houses for sale', 'commercial property', 'residential property'
      ],
      'property_details': [
        'property details', 'more information', 'tell me about', 'property features',
        'amenities', 'specifications', 'floor plan', 'property size', 'bedrooms',
        'bathrooms', 'parking', 'balcony'
      ],
      'pricing_info': [
        'price', 'cost', 'rent', 'budget', 'affordable', 'expensive',
        'price range', 'how much', 'monthly rent', 'deposit', 'maintenance charges'
      ],
      'location_info': [
        'location', 'area', 'neighborhood', 'nearby', 'distance', 'connectivity',
        'transport', 'metro', 'schools', 'hospitals', 'shopping', 'restaurants'
      ],
      'general_inquiry': [
        'hello', 'hi', 'help', 'assistance', 'information', 'question',
        'what can you do', 'how does this work', 'getting started'
      ],
      
      // Sales-handover intents
      'schedule_visit': [
        'schedule visit', 'book appointment', 'site visit', 'property visit',
        'see property', 'visit property', 'viewing', 'inspection', 'tour'
      ],
      'negotiation': [
        'negotiate', 'discount', 'better price', 'lower price', 'deal',
        'bargain', 'offer', 'counter offer', 'final price'
      ],
      'documentation': [
        'documents', 'paperwork', 'agreement', 'contract', 'legal',
        'registration', 'loan', 'mortgage', 'finance', 'emi'
      ],
      'complaint': [
        'complaint', 'problem', 'issue', 'not working', 'broken', 'maintenance',
        'repair', 'dissatisfied', 'unhappy', 'poor service'
      ],
      'complex_requirement': [
        'custom requirement', 'specific need', 'special request', 'modification',
        'customization', 'bulk purchase', 'investment', 'commercial deal'
      ]
    };
    
    this.aiHandleableIntents = [
      'property_search', 'property_details', 'pricing_info', 
      'location_info', 'general_inquiry'
    ];
    
    this.salesIntents = [
      'schedule_visit', 'negotiation', 'documentation', 
      'complaint', 'complex_requirement'
    ];
    
    this.trainClassifier();
  }

  trainClassifier() {
    try {
      // Train with intent patterns
      Object.entries(this.intentPatterns).forEach(([intent, patterns]) => {
        patterns.forEach(pattern => {
          this.classifier.addDocument(pattern, intent);
        });
      });

      this.classifier.train();
      this.isTrained = true;
      logger.info('Intent classifier trained successfully');
    } catch (error) {
      logger.error('Error training intent classifier:', error);
    }
  }

  classifyIntent(message) {
    if (!this.isTrained) {
      logger.warn('Classifier not trained, using fallback classification');
      return this.fallbackClassification(message);
    }

    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      // Get classification result
      const classification = this.classifier.classify(normalizedMessage);
      const confidence = this.classifier.getClassifications(normalizedMessage)[0]?.value || 0;
      
      // Apply confidence threshold
      const minConfidence = 0.6;
      const finalIntent = confidence >= minConfidence ? classification : 'general_inquiry';
      
      // Determine routing
      const shouldHandleWithAI = this.aiHandleableIntents.includes(finalIntent);
      const shouldEscalateToSales = this.salesIntents.includes(finalIntent);
      
      // Extract entities
      const entities = this.extractEntities(normalizedMessage);
      
      return {
        intent: finalIntent,
        confidence: confidence,
        shouldHandleWithAI,
        shouldEscalateToSales,
        entities,
        originalMessage: message,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error classifying intent:', error);
      return this.fallbackClassification(message);
    }
  }

  fallbackClassification(message) {
    const normalizedMessage = message.toLowerCase();
    
    // Simple keyword-based fallback
    const salesKeywords = [
      'visit', 'appointment', 'negotiate', 'discount', 'documents', 
      'complaint', 'problem', 'custom', 'special'
    ];
    
    const hasSalesKeywords = salesKeywords.some(keyword => 
      normalizedMessage.includes(keyword)
    );
    
    return {
      intent: hasSalesKeywords ? 'schedule_visit' : 'general_inquiry',
      confidence: 0.5,
      shouldHandleWithAI: !hasSalesKeywords,
      shouldEscalateToSales: hasSalesKeywords,
      entities: this.extractEntities(normalizedMessage),
      originalMessage: message,
      timestamp: new Date(),
      fallback: true
    };
  }

  extractEntities(message) {
    const entities = {};
    
    // Extract numbers (potential prices, areas, etc.)
    const numbers = message.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
    if (numbers) {
      entities.numbers = numbers.map(n => parseFloat(n.replace(/,/g, '')));
    }
    
    // Extract location mentions
    const locationPatterns = [
      /in\s+([a-zA-Z\s]+?)(?:\s|$|,|\.|!|\?)/gi,
      /near\s+([a-zA-Z\s]+?)(?:\s|$|,|\.|!|\?)/gi,
      /at\s+([a-zA-Z\s]+?)(?:\s|$|,|\.|!|\?)/gi
    ];
    
    const locations = [];
    locationPatterns.forEach(pattern => {
      const matches = [...message.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 2) {
          locations.push(match[1].trim());
        }
      });
    });
    
    if (locations.length > 0) {
      entities.locations = [...new Set(locations)];
    }
    
    // Extract property types
    const propertyTypes = [
      'apartment', 'flat', 'house', 'villa', 'studio', 'penthouse',
      '1bhk', '2bhk', '3bhk', '4bhk', 'commercial', 'office', 'shop'
    ];
    
    const foundPropertyTypes = propertyTypes.filter(type => 
      message.toLowerCase().includes(type)
    );
    
    if (foundPropertyTypes.length > 0) {
      entities.propertyTypes = foundPropertyTypes;
    }
    
    // Extract budget ranges
    const budgetPatterns = [
      /budget\s+(?:of\s+)?(?:rs\.?\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:to\s+(?:rs\.?\s*)?(\d+(?:,\d{3})*(?:\.\d+)?))?/gi,
      /under\s+(?:rs\.?\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
      /below\s+(?:rs\.?\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)/gi
    ];
    
    budgetPatterns.forEach(pattern => {
      const match = message.match(pattern);
      if (match) {
        entities.budget = {
          min: match[1] ? parseFloat(match[1].replace(/,/g, '')) : null,
          max: match[2] ? parseFloat(match[2].replace(/,/g, '')) : null
        };
      }
    });
    
    return entities;
  }

  // Method to retrain classifier with new data
  addTrainingData(message, intent) {
    try {
      this.classifier.addDocument(message.toLowerCase(), intent);
      this.classifier.retrain();
      logger.info(`Added training data: "${message}" -> ${intent}`);
    } catch (error) {
      logger.error('Error adding training data:', error);
    }
  }

  // Get classification statistics
  getClassificationStats() {
    return {
      isTrained: this.isTrained,
      aiIntents: this.aiHandleableIntents,
      salesIntents: this.salesIntents,
      totalPatterns: Object.values(this.intentPatterns)
        .reduce((sum, patterns) => sum + patterns.length, 0)
    };
  }
}