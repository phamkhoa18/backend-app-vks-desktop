import mongoose from 'mongoose';

const OCRResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  fileHash: {
    type: String,
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  html: {
    type: String,
    default: '',
  },
  confidence: {
    type: Number,
    default: 0,
  },
  pages: {
    type: Number,
    default: 1,
  },
  method: {
    type: String,
    enum: ['direct_extraction', 'ocr', 'ocr_failed', 'merged', 'python_ocr'],
    default: 'ocr',
  },
  processingTime: {
    type: String,
    default: '',
  },
  textLength: {
    type: Number,
    default: 0,
  },
  wordCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for quick lookup
OCRResultSchema.index({ user: 1, fileHash: 1 });

// Update updatedAt before save
OCRResultSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const OCRResult = mongoose.model('OCRResult', OCRResultSchema);

export default OCRResult;

