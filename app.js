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
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (non-blocking - server will start even if DB connection fails)
connectDB().catch(err => {
  console.warn('⚠️  MongoDB connection warning:', err.message);
  console.warn('⚠️  Server will continue to run, but database features may not work.');
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
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    // console.log(`Network: http://172.18.108.239:${PORT}`);
  });