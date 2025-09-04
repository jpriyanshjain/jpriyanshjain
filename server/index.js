import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Import routes and middleware
import chatRoutes from './routes/chat.js';
import flowRoutes from './routes/flows.js';
import analyticsRoutes from './routes/analytics.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { ChatHandler } from './services/chatHandler.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/custom-chatbot')
  .then(() => logger.info('Connected to MongoDB'))
  .catch((error) => logger.error('MongoDB connection error:', error));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO for real-time chat
const chatHandler = new ChatHandler();

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-chat', (data) => {
    const { sessionId, userId } = data;
    socket.join(sessionId);
    logger.info(`User ${userId} joined chat session: ${sessionId}`);
  });

  socket.on('send-message', async (data) => {
    try {
      const response = await chatHandler.processMessage(data);
      
      // Send response back to the specific session
      io.to(data.sessionId).emit('receive-message', response);
      
      // If escalation to sales is needed, emit that event
      if (response.escalateToSales) {
        io.to(data.sessionId).emit('escalate-to-sales', {
          sessionId: data.sessionId,
          context: response.context
        });
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      socket.emit('error', {
        message: 'Sorry, I encountered an error processing your message. Please try again.'
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});