import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'custom-chatbot' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for chat interactions
    new winston.transports.File({
      filename: path.join(logsDir, 'chat.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          if (meta.type === 'chat_interaction') {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
          }
          return null;
        }),
        winston.format.unformat()
      )
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
          metaStr = ` ${JSON.stringify(meta)}`;
        }
        return `${timestamp} [${level}] ${message}${metaStr}`;
      })
    )
  }));
}

// Create specialized logging functions
export const chatLogger = {
  logInteraction: (sessionId, message, response, classification, responseTime) => {
    logger.info('Chat interaction', {
      type: 'chat_interaction',
      sessionId,
      userMessage: message,
      botResponse: response,
      intent: classification?.intent,
      confidence: classification?.confidence,
      responseTime,
      timestamp: new Date().toISOString()
    });
  },
  
  logEscalation: (sessionId, reason, context) => {
    logger.info('Sales escalation', {
      type: 'sales_escalation',
      sessionId,
      reason,
      context,
      timestamp: new Date().toISOString()
    });
  },
  
  logFlowExecution: (sessionId, flowId, step, result) => {
    logger.info('Flow execution step', {
      type: 'flow_execution',
      sessionId,
      flowId,
      step,
      result,
      timestamp: new Date().toISOString()
    });
  },
  
  logError: (sessionId, error, context) => {
    logger.error('Chat error', {
      type: 'chat_error',
      sessionId,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
};

export const performanceLogger = {
  logResponseTime: (endpoint, method, responseTime, statusCode) => {
    logger.info('API response time', {
      type: 'performance',
      endpoint,
      method,
      responseTime,
      statusCode,
      timestamp: new Date().toISOString()
    });
  },
  
  logSlowQuery: (query, executionTime, collection) => {
    logger.warn('Slow database query', {
      type: 'slow_query',
      query,
      executionTime,
      collection,
      timestamp: new Date().toISOString()
    });
  }
};

export const analyticsLogger = {
  logUserAction: (sessionId, action, data) => {
    logger.info('User action', {
      type: 'user_action',
      sessionId,
      action,
      data,
      timestamp: new Date().toISOString()
    });
  },
  
  logConversion: (sessionId, conversionType, value) => {
    logger.info('Conversion event', {
      type: 'conversion',
      sessionId,
      conversionType,
      value,
      timestamp: new Date().toISOString()
    });
  }
};

// Export default logger
export default logger;