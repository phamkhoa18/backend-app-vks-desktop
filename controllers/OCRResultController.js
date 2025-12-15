import OCRResult from '../models/OCRResult.js';
import crypto from 'crypto';

/**
 * Generate file hash from file name, size, and user ID
 */
function generateFileHash(fileName, fileSize, userId) {
  const hash = crypto.createHash('sha256');
  hash.update(`${userId}_${fileName}_${fileSize}`);
  return hash.digest('hex');
}

/**
 * Save OCR result
 * POST /api/v1/ocr-results
 */
async function saveOCRResult(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    const {
      fileName,
      fileSize,
      fileType,
      text,
      html,
      confidence,
      pages,
      method,
      processingTime,
      textLength,
      wordCount,
    } = req.body;

    if (!fileName || !fileSize || !fileType || !text) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: fileName, fileSize, fileType, text',
      });
    }

    const fileHash = generateFileHash(fileName, fileSize, userId);

    // Check if result already exists
    let ocrResult = await OCRResult.findOne({ user: userId, fileHash });

    if (ocrResult) {
      // Update existing result
      ocrResult.text = text;
      ocrResult.html = html || '';
      ocrResult.confidence = confidence || 0;
      ocrResult.pages = pages || 1;
      ocrResult.method = method || 'ocr';
      ocrResult.processingTime = processingTime || '';
      ocrResult.textLength = textLength || text.length;
      ocrResult.wordCount = wordCount || text.split(/\s+/).length;
      ocrResult.updatedAt = Date.now();
      await ocrResult.save();
    } else {
      // Create new result
      ocrResult = new OCRResult({
        user: userId,
        fileName,
        fileSize,
        fileType,
        fileHash,
        text,
        html: html || '',
        confidence: confidence || 0,
        pages: pages || 1,
        method: method || 'ocr',
        processingTime: processingTime || '',
        textLength: textLength || text.length,
        wordCount: wordCount || text.split(/\s+/).length,
      });
      await ocrResult.save();
    }

    res.json({
      success: true,
      data: ocrResult,
      message: 'Đã lưu kết quả OCR thành công',
    });
  } catch (error) {
    console.error('Error saving OCR result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lưu kết quả OCR',
    });
  }
}

/**
 * Get OCR result by file hash
 * GET /api/v1/ocr-results/:fileHash
 */
async function getOCRResult(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    const { fileHash } = req.params;

    const ocrResult = await OCRResult.findOne({ user: userId, fileHash });

    if (!ocrResult) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả OCR',
      });
    }

    res.json({
      success: true,
      data: ocrResult,
    });
  } catch (error) {
    console.error('Error getting OCR result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy kết quả OCR',
    });
  }
}

/**
 * Get all OCR results for user
 * GET /api/v1/ocr-results
 */
async function getAllOCRResults(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [results, total] = await Promise.all([
      OCRResult.find({ user: userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-text -html'), // Don't send full text in list
      OCRResult.countDocuments({ user: userId }),
    ]);

    res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error getting OCR results:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách kết quả OCR',
    });
  }
}

/**
 * Check if file has been OCRed
 * POST /api/v1/ocr-results/check
 */
async function checkOCRResult(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    const { fileName, fileSize } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin: fileName, fileSize',
      });
    }

    const fileHash = generateFileHash(fileName, fileSize, userId);
    const ocrResult = await OCRResult.findOne({ user: userId, fileHash });

    if (ocrResult) {
      res.json({
        success: true,
        exists: true,
        data: ocrResult,
      });
    } else {
      res.json({
        success: true,
        exists: false,
      });
    }
  } catch (error) {
    console.error('Error checking OCR result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi kiểm tra kết quả OCR',
    });
  }
}

/**
 * Delete OCR result
 * DELETE /api/v1/ocr-results/:id
 */
async function deleteOCRResult(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
    }

    const { id } = req.params;

    const ocrResult = await OCRResult.findOne({ _id: id, user: userId });

    if (!ocrResult) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả OCR',
      });
    }

    await OCRResult.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Đã xóa kết quả OCR thành công',
    });
  } catch (error) {
    console.error('Error deleting OCR result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi xóa kết quả OCR',
    });
  }
}

const OCRResultController = {
  saveOCRResult,
  getOCRResult,
  getAllOCRResults,
  checkOCRResult,
  deleteOCRResult,
};

export default OCRResultController;

