import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit (tăng lên để hỗ trợ file lớn hơn)
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

// Shared worker để tăng tốc độ xử lý (reuse worker cho nhiều images)
let sharedWorker = null;

/**
 * Get or create shared Tesseract worker
 */
async function getSharedWorker(language = 'vie+eng') {
  if (!sharedWorker) {
    sharedWorker = await createWorker(language, 1, {
      logger: (m) => {
        // Có thể log progress nếu cần
        if (m.status === 'recognizing text') {
          // console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    // Cấu hình Tesseract để tối ưu cho tiếng Việt
    await sharedWorker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ.,;:!?"\'()[]{}-/',
      preserve_interword_spaces: '1',
    });
  }
  return sharedWorker;
}

/**
 * Terminate shared worker (cleanup)
 */
async function terminateSharedWorker() {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
  }
}

/**
 * Preprocess image để tối ưu OCR cho tiếng Việt
 * Áp dụng các kỹ thuật: grayscale, denoise, contrast enhancement, sharpen
 */
async function preprocessImageForOCR(imageBuffer) {
  try {
    let processed = sharp(imageBuffer);
    
    // Lấy metadata
    const metadata = await processed.metadata();
    
    // 1. Convert to grayscale nếu chưa phải (tốt hơn cho OCR)
    processed = processed.greyscale();
    
    // 2. Normalize và tăng contrast
    processed = processed.normalize();
    
    // 3. Adjust gamma để làm rõ text
    processed = processed.gamma(1.2);
    
    // 4. Sharpen để làm rõ edges của chữ
    processed = processed.sharpen({
      sigma: 1.5,
      flat: 1,
      jagged: 2
    });
    
    // 5. Tăng contrast và brightness
    processed = processed.modulate({
      brightness: 1.1,
      saturation: 0,
      hue: 0
    });
    
    // 6. Resize nếu quá lớn (giữ chất lượng nhưng tăng tốc)
    if (metadata.width > 2400 || metadata.height > 2400) {
      processed = processed.resize(2400, 2400, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    // Hoặc nếu quá nhỏ, scale up để OCR tốt hơn
    else if (metadata.width < 600 || metadata.height < 600) {
      const scale = Math.max(600 / metadata.width, 600 / metadata.height);
      processed = processed.resize(
        Math.round(metadata.width * scale),
        Math.round(metadata.height * scale),
        {
          kernel: sharp.kernel.lanczos3
        }
      );
    }
    
    // 7. Convert to PNG (format tốt nhất cho OCR)
    const result = await processed.png().toBuffer();
    
    return result;
  } catch (error) {
    console.warn('Image preprocessing failed, using original:', error.message);
    return imageBuffer;
  }
}

/**
 * Extract text from PDF using pdf-parse (for PDFs with text layer)
 * Improved: Better detection of text content quality
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    const text = data.text.trim();
    
    // Phân tích chất lượng text
    const textLength = text.length;
    const nonWhitespaceChars = text.replace(/\s/g, '').length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Kiểm tra xem có phải là PDF có text thật sự không
    // Nếu chỉ có vài ký tự hoặc toàn số/ký tự đặc biệt thì có thể là scan
    const isRealText = textLength > 100 && 
                       nonWhitespaceChars > 50 && 
                       wordCount > 10 &&
                       /[a-zA-ZÀ-ỹ]/.test(text); // Có chứa chữ cái
    
    return {
      text: text,
      pages: data.numpages,
      confidence: isRealText ? 100 : 30, // Confidence thấp nếu không phải text thật
      isRealText: isRealText,
      textLength: textLength,
      wordCount: wordCount
    };
  } catch (error) {
    throw new Error(`Lỗi khi đọc PDF: ${error.message}`);
  }
}

/**
 * Convert all PDF pages to images
 * Improved: Better resolution and quality for OCR
 */
async function pdfToImages(pdfBuffer, scale = 2.5) {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source for Node.js environment
    // pdfjs-dist v4 requires workerSrc to be set
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        const workerPath = path.resolve(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
        
        // Check if worker file exists
        const fs = await import('fs');
        if (!fs.existsSync(workerPath)) {
          throw new Error(`Worker file not found at: ${workerPath}`);
        }
        
        // For Node.js, use file:// protocol with proper path format
        // Windows: file:///D:/path/to/file (with 3 slashes)
        let workerUrl;
        if (process.platform === 'win32') {
          // Windows: D:\path\to\file -> file:///D:/path/to/file
          const driveLetter = workerPath.match(/^([A-Z]):/)?.[1];
          if (driveLetter) {
            const pathWithoutDrive = workerPath.replace(/^[A-Z]:/, '').replace(/\\/g, '/');
            workerUrl = `file:///${driveLetter}:${pathWithoutDrive}`;
          } else {
            const normalizedPath = workerPath.replace(/\\/g, '/');
            workerUrl = `file:///${normalizedPath}`;
          }
        } else {
          // Unix/Linux/Mac: file:///path/to/file
          workerUrl = `file://${workerPath}`;
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        console.log('PDF.js worker configured for Node.js:', workerUrl);
      } catch (e) {
        console.error('Failed to configure PDF.js worker:', e.message);
        // Try to use a dummy worker src that might work
        // Some versions of pdfjs-dist might accept this
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:application/javascript;base64,';
        console.warn('Using fallback worker configuration');
      }
    }
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    // pdfjs-dist requires Uint8Array, not Buffer
    const uint8Array = pdfBuffer instanceof Buffer 
      ? new Uint8Array(pdfBuffer) 
      : pdfBuffer instanceof Uint8Array 
        ? pdfBuffer 
        : new Uint8Array(pdfBuffer);
    
    // Get PDF document
    let pdfDocument;
    try {
      const loadingTask = pdfjsLib.getDocument({ 
        data: uint8Array,
        verbosity: 0 // Suppress warnings
      });
      pdfDocument = await loadingTask.promise;
    } catch (error) {
      // If worker error, provide clear error message
      if (error.message && (error.message.includes('worker') || error.message.includes('GlobalWorkerOptions'))) {
        throw new Error(
          'PDF.js worker không thể load. Để OCR PDF scan, cần cấu hình worker đúng cách. ' +
          'Hiện tại chỉ hỗ trợ: (1) OCR ảnh, (2) PDF có text layer. ' +
          `Chi tiết lỗi: ${error.message}`
        );
      }
      throw error;
    }
    const numPages = pdfDocument.numPages;
    
    console.log(`PDF có ${numPages} trang, scale: ${scale}x`);
    
    // Check if canvas is available
    let createCanvas;
    try {
      const canvasModule = await import('canvas');
      createCanvas = canvasModule.createCanvas;
    } catch (error) {
      throw new Error(
        'Canvas module không được cài đặt. ' +
        'PDF scan (đã quét) cần canvas để render. ' +
        'Vui lòng cài đặt canvas hoặc chỉ sử dụng PDF có text layer hoặc ảnh. ' +
        'Lỗi: ' + error.message
      );
    }
    
    const images = [];
    
    // Process pages sequentially để tránh memory issues với PDF lớn
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDocument.getPage(pageNum);
        
        // Tăng scale để có độ phân giải cao hơn cho OCR tốt hơn
        // Scale 2.5-3.0 là tốt nhất cho OCR (cân bằng chất lượng và tốc độ)
        const viewport = page.getViewport({ scale: scale });
        
        // Limit max dimensions để tránh memory issues
        const maxWidth = 3000;
        const maxHeight = 3000;
        
        let finalScale = scale;
        if (viewport.width > maxWidth || viewport.height > maxHeight) {
          finalScale = Math.min(
            maxWidth / page.view[2],
            maxHeight / page.view[3]
          );
          const adjustedViewport = page.getViewport({ scale: finalScale });
          viewport.width = adjustedViewport.width;
          viewport.height = adjustedViewport.height;
        }
        
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        
        // Fill white background (important for OCR)
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Convert canvas to PNG buffer
        const imageBuffer = canvas.toBuffer('image/png');
        images.push(imageBuffer);
        
        console.log(`Đã chuyển đổi trang ${pageNum}/${numPages} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
      } catch (pageError) {
        console.error(`Lỗi khi xử lý trang ${pageNum}:`, pageError.message);
        // Continue with other pages even if one fails
        throw pageError; // Hoặc có thể skip trang lỗi
      }
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error(`Lỗi khi chuyển đổi PDF sang ảnh: ${error.message}`);
  }
}

/**
 * OCR image using Tesseract.js with Vietnamese language
 * Optimized for Vietnamese text recognition
 */
async function ocrImage(imageBuffer, language = 'vie+eng', useSharedWorker = false) {
  try {
    // Preprocess image trước khi OCR
    const processedImage = await preprocessImageForOCR(imageBuffer);
    
    let worker;
    let shouldTerminate = false;
    
    if (useSharedWorker) {
      worker = await getSharedWorker(language);
    } else {
      worker = await createWorker(language, 1, {
        logger: () => {} // Silent logging
      });
      
      // Cấu hình tối ưu cho tiếng Việt
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ.,;:!?"\'()[]{}-/',
        preserve_interword_spaces: '1',
      });
      shouldTerminate = true;
    }
    
    const { data } = await worker.recognize(processedImage);
    
    if (shouldTerminate) {
      await worker.terminate();
    }
    
    // Làm sạch text (loại bỏ các ký tự không mong muốn)
    let cleanText = data.text.trim();
    // Loại bỏ các dòng chỉ có whitespace
    cleanText = cleanText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
    
    return {
      text: cleanText,
      confidence: data.confidence || 0,
      words: data.words || []
    };
  } catch (error) {
    throw new Error(`Lỗi OCR: ${error.message}`);
  }
}

/**
 * OCR multiple images and combine results
 * Optimized with shared worker for better performance
 */
async function ocrImages(images, language = 'vie+eng') {
  try {
    // Preprocess tất cả images trước
    const processedImages = await Promise.all(
      images.map(img => preprocessImageForOCR(img))
    );
    
    // Sử dụng shared worker để tăng tốc
    const worker = await getSharedWorker(language);
    
    const results = [];
    const totalPages = processedImages.length;
    
    for (let i = 0; i < processedImages.length; i++) {
      console.log(`Đang OCR trang ${i + 1}/${totalPages}...`);
      
      const { data } = await worker.recognize(processedImages[i]);
      
      // Làm sạch text
      let cleanText = data.text.trim();
      cleanText = cleanText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
      
      results.push({
        text: cleanText,
        confidence: data.confidence || 0,
        page: i + 1
      });
    }
    
    // Combine all texts với phân trang rõ ràng
    const pageNumbers = results.map((_, idx) => idx + 1);
    const combinedText = results
      .map((r, idx) => {
        if (results.length === 1) return r.text;
        return `--- Trang ${r.page} ---\n\n${r.text}`;
      })
      .join('\n\n');
    
    const avgConfidence = results.length > 0
      ? results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length
      : 0;
    
    return {
      text: combinedText,
      confidence: avgConfidence,
      pages: results.length,
      pageResults: results
    };
  } catch (error) {
    throw new Error(`Lỗi OCR: ${error.message}`);
  }
}

/**
 * Process PDF file - try text extraction first, then OCR if needed
 * Improved: Better detection logic for scanned vs text PDF
 */
async function processPDF(fileBuffer, fileName, options = {}) {
  const { forceOCR = false, language = 'vie+eng' } = options;
  
  try {
    // Nếu force OCR thì bỏ qua text extraction
    if (forceOCR) {
      console.log('Force OCR mode - bỏ qua text extraction');
    } else {
      // First, try to extract text directly from PDF
      let extractedResult;
      try {
        extractedResult = await extractTextFromPDF(fileBuffer);
        console.log(`PDF có ${extractedResult.pages} trang, text length: ${extractedResult.textLength}, words: ${extractedResult.wordCount}`);
      } catch (error) {
        console.log('Không thể đọc text từ PDF, sẽ OCR:', error.message);
        extractedResult = { text: '', pages: 0, isRealText: false };
      }
      
      // Kiểm tra chất lượng text
      // Nếu có text thật sự và đủ dài, sử dụng nó
      if (extractedResult.isRealText && 
          extractedResult.text && 
          extractedResult.text.trim().length > 100 &&
          extractedResult.wordCount > 15 &&
          extractedResult.confidence >= 80) {
        console.log('PDF có text layer tốt, sử dụng text extraction');
        return {
          text: extractedResult.text,
          pages: extractedResult.pages,
          confidence: extractedResult.confidence,
          method: 'direct_extraction',
          textLength: extractedResult.textLength,
          wordCount: extractedResult.wordCount
        };
      }
      
      // Nếu có text nhưng chất lượng thấp, vẫn có thể dùng nhưng sẽ thêm OCR
      if (extractedResult.text && extractedResult.text.trim().length > 50 && extractedResult.confidence < 80) {
        console.log('PDF có text nhưng chất lượng thấp, sẽ kết hợp với OCR');
        // Tiếp tục OCR nhưng có thể merge với text đã có
      } else {
        console.log('PDF không có text layer đáng kể, cần OCR toàn bộ');
      }
    }
    
    // Convert PDF to images for OCR
    console.log('Đang chuyển đổi PDF sang ảnh...');
    let images;
    try {
      images = await pdfToImages(fileBuffer);
      console.log(`Đã chuyển đổi ${images.length} trang sang ảnh`);
    } catch (error) {
      console.error('Lỗi khi chuyển PDF sang ảnh:', error);
      
      // Check if error is about missing canvas
      if (error.message && (error.message.includes('Canvas') || error.message.includes('canvas'))) {
        return {
          text: '',
          pages: extractedResult?.pages || 0,
          error: `PDF này là file scan (không có text layer). Để OCR PDF scan, cần cài đặt module canvas. ` +
                 `Hiện tại chỉ hỗ trợ: (1) OCR ảnh, (2) PDF có text layer. ` +
                 `Chi tiết: ${error.message}`,
          method: 'ocr_failed_missing_canvas'
        };
      }
      
      // Check if error is about worker
      if (error.message && (error.message.includes('worker') || error.message.includes('GlobalWorkerOptions'))) {
        return {
          text: '',
          pages: extractedResult?.pages || 0,
          error: `PDF scan không thể xử lý do vấn đề cấu hình PDF.js worker. ` +
                 `Hiện tại chỉ hỗ trợ: (1) OCR ảnh, (2) PDF có text layer. ` +
                 `Nếu cần OCR PDF scan, vui lòng liên hệ admin để cấu hình. ` +
                 `Chi tiết: ${error.message}`,
          method: 'ocr_failed_worker_error'
        };
      }
      
      throw new Error(`Không thể chuyển đổi PDF sang ảnh: ${error.message}`);
    }
    
    if (!images || images.length === 0) {
      throw new Error('Không thể tạo ảnh từ PDF');
    }
    
    // Images đã được preprocess trong hàm pdfToImages
    // Nhưng chúng ta sẽ preprocess lại trong ocrImages để tối ưu hơn
    console.log('Đang OCR PDF...');
    const result = await ocrImages(images, language);
    
    return {
      text: result.text,
      pages: result.pages,
      confidence: result.confidence,
      method: 'ocr',
      pageResults: result.pageResults
    };
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error(`Lỗi khi xử lý PDF: ${error.message}`);
  }
}

/**
 * Process image file - optimize and use OCR
 * Improved: Better preprocessing for Vietnamese text
 */
async function processImage(fileBuffer, mimeType, options = {}) {
  const { language = 'vie+eng', useSharedWorker = false } = options;
  
  try {
    console.log(`Đang xử lý image, type: ${mimeType}`);
    
    // Image sẽ được preprocess trong hàm ocrImage
    // Perform OCR with Vietnamese language
    const result = await ocrImage(fileBuffer, language, useSharedWorker);
    
    return {
      text: result.text,
      confidence: result.confidence,
      method: 'ocr',
      words: result.words || []
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error(`Lỗi khi xử lý ảnh: ${error.message}`);
  }
}

const OCRController = {
  /**
   * Extract text from uploaded file (PDF or Image)
   * POST /api/v1/ocr/extract-text
   * FormData: 
   *   - file (PDF or Image) - required
   *   - forceOCR (optional) - 'true' để force OCR ngay cả khi PDF có text
   *   - language (optional) - Ngôn ngữ OCR, mặc định 'vie+eng'
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
        
        // Parse options từ request body hoặc query
        const forceOCR = req.body.forceOCR === 'true' || req.query.forceOCR === 'true';
        const language = req.body.language || req.query.language || 'vie+eng';
        
        const options = {
          forceOCR,
          language
        };
        
        let result;
        const startTime = Date.now();

        console.log(`Đang xử lý file: ${originalname}, type: ${mimetype}, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Process based on file type
        if (mimetype === 'application/pdf') {
          result = await processPDF(buffer, originalname, options);
        } else if (mimetype.startsWith('image/')) {
          result = await processImage(buffer, mimetype, options);
        } else {
          return res.status(400).json({
            success: false,
            message: 'File type không được hỗ trợ'
          });
        }

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Return result
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
          method: result.method || 'unknown',
          processingTime: `${processingTime}s`,
          textLength: result.text?.length || 0,
          wordCount: result.wordCount || (result.text ? result.text.split(/\s+/).filter(w => w.length > 0).length : 0),
          pageResults: result.pageResults || undefined
        });
      } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Đã xảy ra lỗi khi xử lý file',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  ],

  /**
   * Health check endpoint
   * GET /api/v1/ocr/health
   */
  health: async (req, res) => {
    try {
      // Test if Tesseract is working
      const { createWorker } = await import('tesseract.js');
      const testWorker = await createWorker('vie', 1);
      await testWorker.terminate();
      
      res.status(200).json({
        success: true,
        status: 'healthy',
        message: 'OCR service đang hoạt động bình thường',
        languages: ['vie', 'eng', 'vie+eng'],
        supportedFormats: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff']
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        message: 'OCR service không hoạt động',
        error: error.message
      });
    }
  },

  /**
   * Cleanup shared worker (for maintenance)
   * POST /api/v1/ocr/cleanup
   */
  cleanup: async (req, res) => {
    try {
      await terminateSharedWorker();
      res.status(200).json({
        success: true,
        message: 'Đã dọn dẹp shared worker'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

// Cleanup on process exit
process.on('SIGINT', async () => {
  console.log('Cleaning up OCR workers...');
  await terminateSharedWorker();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Cleaning up OCR workers...');
  await terminateSharedWorker();
  process.exit(0);
});

export default OCRController;
