import mongoose from 'mongoose';

const FormSubmissionSchema = new mongoose.Schema({
  // Position/Form name - xác định loại form (ví dụ: 'giahantamgiam', 'baocao', etc.)
  position: {
    type: String,
    required: true,
    index: true
  },
  
  // User làm việc - người tạo/submit form
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Nội dung form (HTML content từ RichTextEditor)
  content: {
    type: String,
    required: true
  },
  
  // Case ID - liên kết với vụ án (optional)
  case_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    index: true
  },
  
  // Trạng thái form
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft',
    index: true
  },
  
  // Metadata bổ sung
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Ghi chú
  notes: {
    type: String
  },
  
  // Người duyệt (nếu có)
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Ngày duyệt
  approved_at: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes để tối ưu query
FormSubmissionSchema.index({ position: 1, user_id: 1 });
FormSubmissionSchema.index({ case_id: 1 });
FormSubmissionSchema.index({ status: 1 });
FormSubmissionSchema.index({ createdAt: -1 });

const FormSubmission = mongoose.model('FormSubmission', FormSubmissionSchema);

export default FormSubmission;

