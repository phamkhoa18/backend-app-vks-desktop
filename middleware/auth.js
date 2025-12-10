import Users from '../models/Users.js';

/**
 * Middleware để lấy user từ request
 * Có thể lấy từ:
 * 1. Authorization header (Bearer token) - nếu có JWT sau này
 * 2. x-user-id header - tạm thời cho development
 * 3. req.body.userId - nếu frontend gửi kèm
 * 
 * Nếu không có user, req.user sẽ là null (không block request)
 */
export const getUserFromRequest = async (req, res, next) => {
  try {
    let userId = null;

    // Option 1: Lấy từ header x-user-id (tạm thời cho development)
    if (req.headers['x-user-id']) {
      userId = req.headers['x-user-id'];
    }
    // Option 2: Lấy từ Authorization header (Bearer token) - sẽ implement JWT sau
    else if (req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      // TODO: Verify JWT token và lấy user ID từ token
      // Hiện tại tạm thời bỏ qua
    }
    // Option 3: Lấy từ request body
    else if (req.body?.userId) {
      userId = req.body.userId;
      // Xóa userId khỏi body để không lưu vào database
      delete req.body.userId;
    }

    // Nếu có userId, lấy thông tin user từ database
    if (userId) {
      try {
        const user = await Users.findById(userId);
        if (user) {
          req.user = user;
          req.userId = userId;
        } else {
          req.user = null;
          req.userId = null;
        }
      } catch (error) {
        // Nếu không tìm thấy user, set null
        req.user = null;
        req.userId = null;
      }
    } else {
      req.user = null;
      req.userId = null;
    }

    next();
  } catch (error) {
    // Nếu có lỗi, vẫn tiếp tục nhưng không có user
    req.user = null;
    req.userId = null;
    next();
  }
};

/**
 * Middleware để yêu cầu authentication (optional)
 * Nếu không có user, sẽ trả về 401
 */
export const requireAuth = (req, res, next) => {
  if (!req.user || !req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

