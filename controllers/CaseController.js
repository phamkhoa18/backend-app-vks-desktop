import Case from '../models/Case.js';

const CaseController = {
  /**
   * Lấy tất cả vụ án
   * Query params: page, limit, search, trang_thai
   */
  getAllCases: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';
      const trang_thai = req.query.trang_thai;

      // Build query
      const query = {};
      
      if (search) {
        query.$or = [
          { 'vu_an.ma_vu_an': { $regex: search, $options: 'i' } },
          { 'vu_an.ten_vu_an': { $regex: search, $options: 'i' } },
          { 'bi_can.ho_ten': { $regex: search, $options: 'i' } }
        ];
      }

      if (trang_thai) {
        query['vu_an.trang_thai'] = trang_thai;
      }

      const cases = await Case.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('created_by', 'name email')
        .populate('updated_by', 'name email');

      const total = await Case.countDocuments(query);

      res.status(200).json({
        success: true,
        data: cases,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        message: 'Cases fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Lấy vụ án theo ID
   */
  getCaseById: async (req, res) => {
    try {
      const caseData = await Case.findById(req.params.id)
        .populate('created_by')
        .populate('updated_by', 'name email');

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      res.status(200).json({
        success: true,
        data: caseData,
        message: 'Case fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Tạo vụ án mới
   */
  createCase: async (req, res) => {
    try {
      // Validate required fields
      if (!req.body.vu_an || !req.body.vu_an.ma_vu_an || !req.body.vu_an.ten_vu_an) {
        return res.status(400).json({
          success: false,
          message: 'Mã vụ án và tên vụ án là bắt buộc'
        });
      }

      // Check if ma_vu_an already exists
      const existingCase = await Case.findOne({ 'vu_an.ma_vu_an': req.body.vu_an.ma_vu_an });
      if (existingCase) {
        return res.status(400).json({
          success: false,
          message: 'Mã vụ án đã tồn tại'
        });
      }

      // Get user ID from request (từ middleware auth)
      const userId = req.userId || req.user?._id;

      const now = new Date();
      const caseData = {
        ...req.body,
        created_by: userId || undefined,
        updated_by: userId || undefined,
        createdAt: now, // Đảm bảo createdAt được set
        updatedAt: now  // Đảm bảo updatedAt được set
      };

      const newCase = await Case.create(caseData);

      res.status(201).json({
        success: true,
        data: newCase,
        message: 'Case created successfully'
      });
    } catch (error) {
      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Mã vụ án đã tồn tại'
        });
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Cập nhật vụ án
   */
  updateCase: async (req, res) => {
    try {
      // Get user ID from request (từ middleware auth)
      const userId = req.userId || req.user?._id;

      const updatedCase = await Case.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          updated_by: userId || undefined,
          updatedAt: new Date() // Đảm bảo updatedAt được cập nhật
        },
        {
          new: true,
          runValidators: true,
          timestamps: true // Đảm bảo timestamps được xử lý
        }
      )
        .populate('created_by', 'name email')
        .populate('updated_by', 'name email');

      if (!updatedCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      res.status(200).json({
        success: true,
        data: updatedCase,
        message: 'Case updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Xóa vụ án
   */
  deleteCase: async (req, res) => {
    try {
      const deletedCase = await Case.findByIdAndDelete(req.params.id);

      if (!deletedCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { message: 'Case deleted successfully' },
        message: 'Case deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

export default CaseController;

