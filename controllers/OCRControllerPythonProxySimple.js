import multer from 'multer';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/tiff'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type không được hỗ trợ. Chỉ hỗ trợ PDF và hình ảnh.'));
    }
  }
});

// Python OCR Service URL
const PYTHON_OCR_URL = process.env.PYTHON_OCR_URL || 'http://localhost:5001';

/**
 * Forward OCR request to Python service
 * Sử dụng cách đơn giản: pipe file buffer trực tiếp
 */
async function forwardToPythonOCR(fileBuffer, fileName, mimetype, options = {}) {
  try {
    // Use form-data package (cần cài: npm install form-data)
    let FormData;
    try {
      FormData = (await import('form-data')).default;
    } catch (e) {
      throw new Error('Cần cài đặt form-data: npm install form-data');
    }
    
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimetype
    });
    
    if (options.forceOCR) {
      formData.append('forceOCR', 'true');
    }
    if (options.language) {
      formData.append('language', options.language);
    }
    
    const response = await fetch(`${PYTHON_OCR_URL}/extract-text`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Python OCR service error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Convert Python service response to Node.js format
    return {
      text: result.text || '',
      pages: result.pages || 1,
      confidence: result.confidence || 0,
      method: result.method || 'python_ocr',
      processingTime: result.processing_time,
      textLength: result.text_length,
      wordCount: result.word_count,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Lỗi khi gọi Python OCR service: ${error.message}`);
  }
}

/**
 * Check if Python OCR service is available
 */
async function checkPythonOCRHealth() {
  try {
    const response = await fetch(`${PYTHON_OCR_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        status: data.status || 'unknown',
        message: data.message || 'Service available'
      };
    }
    return { available: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { available: false, message: error.message };
  }
}

const OCRControllerPythonProxy = {
  /**
   * Extract text from uploaded file using Python OCR service
   * POST /api/v1/ocr/extract-text-python
   * FormData: file (PDF or Image), forceOCR (optional), language (optional)
   */
  extractText: [
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Không có file được upload'
          });
        }

        const { buffer, mimetype, originalname } = req.file;
        
        // Parse options
        const forceOCR = req.body.forceOCR === 'true' || req.query.forceOCR === 'true';
        const language = req.body.language || req.query.language || 'vie+eng';
        
        const options = {
          forceOCR,
          language
        };
        
        const startTime = Date.now();
        
        console.log(`Đang forward OCR request tới Python service: ${originalname}`);

        // Forward to Python service
        const result = await forwardToPythonOCR(buffer, originalname, mimetype, options);
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        if (result.error) {
          return res.status(200).json({
            success: false,
            text: result.text || '',
            pages: result.pages || 1,
            confidence: result.confidence || 0,
            error: result.error,
            method: result.method,
            processingTime: `${processingTime}s`
          });
        }

        res.status(200).json({
          success: true,
          text: result.text || '',
          pages: result.pages || 1,
          confidence: result.confidence || 0,
          method: result.method || 'python_ocr',
          processingTime: `${processingTime}s`,
          textLength: result.textLength || 0,
          wordCount: result.wordCount || 0
        });
      } catch (error) {
        console.error('Python OCR Proxy Error:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Đã xảy ra lỗi khi xử lý file',
          error: error.message,
          hint: `Đảm bảo Python OCR service đang chạy tại ${PYTHON_OCR_URL}. Chạy: cd ocr-service-python && python app.py`
        });
      }
    }
  ],

  /**
   * Health check - check Python OCR service
   * GET /api/v1/ocr/python-health
   */
  health: async (req, res) => {
    try {
      const health = await checkPythonOCRHealth();
      
      res.status(200).json({
        success: health.available,
        pythonService: {
          available: health.available,
          url: PYTHON_OCR_URL,
          status: health.status,
          message: health.message
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        pythonService: {
          available: false,
          url: PYTHON_OCR_URL,
          error: error.message
        }
      });
    }
  }
};

export default OCRControllerPythonProxy;

