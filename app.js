import express from 'express';
import mongoose from 'mongoose';

import dotenv from 'dotenv';
import morgan from 'morgan';
import connectDB from './utils/connectDB.js';
import cors from 'cors';
// Routes
import UsersRouter from './routers/UsersRouter.js';
import LawRouter from './routers/LawRouter.js';
import CaseRouter from './routers/CaseRouter.js';
import FormRouter from './routers/FormRouter.js';
import OCRRouter from './routers/OCRRouter.js';

dotenv.config();
// Initialize Express app
const app = express();
app.use(morgan('dev'));

// CORS Configuration - Allow all origins
const corsOptions = {
  origin: '*', // Allow all origins
  credentials: false, // Must be false when origin is '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'X-File-Name'],
  exposedHeaders: ['X-File-Name']
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (non-blocking - server will start even if DB connection fails)
connectDB().catch(err => {
  console.warn('⚠️  MongoDB connection warning:', err.message);
  console.warn('⚠️  Server will continue to run, but database features may not work.');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/v1/users', UsersRouter);
app.use('/api/v1/law', LawRouter);
app.use('/api/v1/cases', CaseRouter);
app.use('/api/v1/forms', FormRouter);
app.use('/api/v1/ocr', OCRRouter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
  });
  
  // Start server
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${HOST}:${PORT}`);
    console.log(`📡 API Base URL: http://${HOST}:${PORT}/api/v1`);
    
    // Log environment info
    console.log(`\n📋 Environment Info:`);
    console.log(`   - Node Version: ${process.version}`);
    console.log(`   - MongoDB URI: ${process.env.MONGO_URI ? '✅ Set' : '❌ Not set'}`);
    console.log(`   - JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
  });