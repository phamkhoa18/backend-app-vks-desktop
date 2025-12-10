import FormData from '../models/FormData.js';

const FormDataController = {
  /**
   * Lấy hoặc tạo form data
   * Nếu đã có thì trả về, nếu chưa có thì tạo mới
   * Query params: position, case_id (optional)
   */
  getOrCreateFormData: async (req, res) => {
    try {
      const { position, case_id } = req.query;
      const userId = req.userId || req.user?._id;

      if (!position) {
        return res.status(400).json({
          success: false,
          message: 'Position là bắt buộc'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID là bắt buộc. Vui lòng đăng nhập.'
        });
      }

      // Tìm form data hiện có
      const query = {
        position,
        user_id: userId,
        case_id: case_id || null
      };

      let formData = await FormData.findOne(query);

      // Nếu chưa có thì tạo mới
      if (!formData) {
        formData = await FormData.create({
          position,
          user_id: userId,
          case_id: case_id || null,
          data: {}
        });
      }

      res.status(200).json({
        success: true,
        data: formData,
        message: 'Form data fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Lưu form data (create or update)
   * Body: position, data (object), case_id (optional)
   */
  saveFormData: async (req, res) => {
    try {
      const { position, data, case_id } = req.body;
      const userId = req.userId || req.user?._id;

      if (!position) {
        return res.status(400).json({
          success: false,
          message: 'Position là bắt buộc'
        });
      }

      if (!data || typeof data !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Data phải là một object'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID là bắt buộc. Vui lòng đăng nhập.'
        });
      }

      // Tìm form data hiện có
      const query = {
        position,
        user_id: userId,
        case_id: case_id || null
      };

      // Update hoặc create
      const formData = await FormData.findOneAndUpdate(
        query,
        {
          position,
          user_id: userId,
          case_id: case_id || null,
          data,
          notes: req.body.notes || undefined
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

      res.status(200).json({
        success: true,
        data: formData,
        message: 'Form data saved successfully'
      });
    } catch (error) {
      // Xử lý lỗi duplicate key (nếu có)
      if (error.code === 11000) {
        // Nếu bị duplicate, thử update lại
        try {
          const { position, data, case_id } = req.body;
          const userId = req.userId || req.user?._id;
          
          const query = {
            position,
            user_id: userId,
            case_id: case_id || null
          };

          const formData = await FormData.findOneAndUpdate(
            query,
            { data, notes: req.body.notes || undefined },
            { new: true, runValidators: true }
          );

          return res.status(200).json({
            success: true,
            data: formData,
            message: 'Form data saved successfully'
          });
        } catch (retryError) {
          return res.status(500).json({
            success: false,
            message: retryError.message
          });
        }
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Lấy form data theo position và case_id
   * Params: position
   * Query: case_id (optional)
   */
  getFormData: async (req, res) => {
    try {
      const { position } = req.params;
      const { case_id } = req.query;
      const userId = req.userId || req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID là bắt buộc. Vui lòng đăng nhập.'
        });
      }

      const query = {
        position,
        user_id: userId,
        case_id: case_id || null
      };

      const formData = await FormData.findOne(query);

      if (!formData) {
        return res.status(200).json({
          success: true,
          data: null,
          message: 'Form data not found'
        });
      }

      res.status(200).json({
        success: true,
        data: formData,
        message: 'Form data fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Xóa form data
   * Params: position
   * Query: case_id (optional)
   */
  deleteFormData: async (req, res) => {
    try {
      const { position } = req.params;
      const { case_id } = req.query;
      const userId = req.userId || req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID là bắt buộc. Vui lòng đăng nhập.'
        });
      }

      const query = {
        position,
        user_id: userId,
        case_id: case_id || null
      };

      const formData = await FormData.findOneAndDelete(query);

      if (!formData) {
        return res.status(404).json({
          success: false,
          message: 'Form data not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { message: 'Form data deleted successfully' },
        message: 'Form data deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Lấy tất cả form data của user (có thể filter theo position)
   * Query: position (optional)
   */
  getAllFormData: async (req, res) => {
    try {
      const userId = req.userId || req.user?._id;
      const { position } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID là bắt buộc. Vui lòng đăng nhập.'
        });
      }

      const query = { user_id: userId };
      if (position) {
        query.position = position;
      }

      const formDataList = await FormData.find(query)
        .sort({ updatedAt: -1 })
        .populate('case_id', 'vu_an.ma_vu_an vu_an.ten_vu_an');

      res.status(200).json({
        success: true,
        data: formDataList,
        message: 'Form data list fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

export default FormDataController;

