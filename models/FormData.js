import mongoose from 'mongoose';

const FormDataSchema = new mongoose.Schema({
  // Position/Form name - xác định loại form (ví dụ: 'giahantamgiam', 'baocao', etc.)
  position: {
    type: String,
    required: true,
    index: true
  },
  
  // User làm việc - người tạo/lưu form data
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Case ID - liên kết với vụ án (optional, có thể là null nếu form không liên quan đến case)
  case_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    index: true,
    default: null
  },
  
  // Form data - lưu các answers từ ConfirmationModal hoặc các input khác
  // Format: { questionId: answer, ... }
  // Ví dụ: { lanthu: '1', ngaybaocaogiahan: '2025-01-15', ... }
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  
  // Ghi chú (optional)
  notes: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index để đảm bảo unique cho mỗi combination (position, user_id, case_id)
// Cho phép mỗi user có một bản ghi form data cho mỗi position và case_id
FormDataSchema.index({ position: 1, user_id: 1, case_id: 1 }, { unique: true });

// Indexes để tối ưu query
FormDataSchema.index({ position: 1, user_id: 1 });
FormDataSchema.index({ case_id: 1 });
FormDataSchema.index({ createdAt: -1 });
FormDataSchema.index({ updatedAt: -1 });

const FormData = mongoose.model('FormData', FormDataSchema);

export default FormData;

