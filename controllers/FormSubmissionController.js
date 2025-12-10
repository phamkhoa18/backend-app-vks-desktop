import FormSubmission from '../models/FormSubmission.js';
import DocxService from '../services/DocxService.js';
import htmlDocx from 'html-docx-js';
import mammoth from 'mammoth';
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FormSubmissionController = {
  /**
   * Lấy tất cả form submissions
   * Query params: page, limit, position, user_id, case_id, status
   */
  getAllFormSubmissions: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const { position, user_id, case_id, status } = req.query;

      // Build query
      const query = {};
      
      if (position) {
        query.position = position;
      }
      
      if (user_id) {
        query.user_id = user_id;
      }
      
      if (case_id) {
        query.case_id = case_id;
      }
      
      if (status) {
        query.status = status;
      }

      const formSubmissions = await FormSubmission.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'name email thongtin_ksv')
        .populate('case_id', 'vu_an.ma_vu_an vu_an.ten_vu_an')
        .populate('approved_by', 'name email');

      const total = await FormSubmission.countDocuments(query);

      res.status(200).json({
        success: true,
        data: formSubmissions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        message: 'Form submissions fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Lấy form submission theo ID
   */
  getFormSubmissionById: async (req, res) => {
    try {
      // Kiểm tra nếu id là một route đặc biệt, trả về 404
      const specialRoutes = ['parse-docx-template-to-html', 'parse-docx-to-html', 'html-to-docx', 'generate-docx', 'templates', 'data'];
      if (specialRoutes.includes(req.params.id)) {
        return res.status(404).json({
          success: false,
          message: 'Form submission not found'
        });
      }
      
      const formSubmission = await FormSubmission.findById(req.params.id)
        .populate('user_id', 'name email thongtin_ksv')
        .populate('case_id', 'vu_an.ma_vu_an vu_an.ten_vu_an')
        .populate('approved_by', 'name email');

      if (!formSubmission) {
        return res.status(404).json({
          success: false,
          message: 'Form submission not found'
        });
      }

      res.status(200).json({
        success: true,
        data: formSubmission,
        message: 'Form submission fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Tạo form submission mới
   * Body: position, content, case_id (optional), metadata (optional)
   */
  createFormSubmission: async (req, res) => {
    try {
      // Validate required fields
      if (!req.body.position || !req.body.content) {
        return res.status(400).json({
          success: false,
          message: 'Position và content là bắt buộc'
        });
      }

      // Get user ID from request (từ middleware auth)
      const userId = req.userId || req.user?._id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID là bắt buộc. Vui lòng đăng nhập hoặc cung cấp user_id.'
        });
      }

      const formSubmissionData = {
        position: req.body.position,
        content: req.body.content,
        user_id: userId,
        case_id: req.body.case_id || undefined,
        status: req.body.status || 'draft',
        metadata: req.body.metadata || {},
        notes: req.body.notes || undefined
      };

      const newFormSubmission = await FormSubmission.create(formSubmissionData);

      // Populate để trả về thông tin đầy đủ
      await newFormSubmission.populate('user_id', 'name email thongtin_ksv');
      if (newFormSubmission.case_id) {
        await newFormSubmission.populate('case_id', 'vu_an.ma_vu_an vu_an.ten_vu_an');
      }

      res.status(201).json({
        success: true,
        data: newFormSubmission,
        message: 'Form submission created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Cập nhật form submission
   */
  updateFormSubmission: async (req, res) => {
    try {
      const formSubmission = await FormSubmission.findById(req.params.id);

      if (!formSubmission) {
        return res.status(404).json({
          success: false,
          message: 'Form submission not found'
        });
      }

      // Chỉ cho phép user tạo form mới được cập nhật (hoặc admin)
      const userId = req.userId || req.user?._id;
      const isOwner = formSubmission.user_id.toString() === userId?.toString();
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền cập nhật form submission này'
        });
      }

      // Cập nhật các trường được phép
      const updateData = {};
      
      if (req.body.content !== undefined) {
        updateData.content = req.body.content;
      }
      
      if (req.body.status !== undefined) {
        // Chỉ admin mới có thể thay đổi status thành approved/rejected
        if (['approved', 'rejected'].includes(req.body.status) && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Chỉ admin mới có thể duyệt/từ chối form submission'
          });
        }
        updateData.status = req.body.status;
        
        // Nếu được duyệt, lưu thông tin người duyệt
        if (req.body.status === 'approved' && isAdmin) {
          updateData.approved_by = userId;
          updateData.approved_at = new Date();
        }
      }
      
      if (req.body.case_id !== undefined) {
        updateData.case_id = req.body.case_id;
      }
      
      if (req.body.metadata !== undefined) {
        updateData.metadata = req.body.metadata;
      }
      
      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }

      const updatedFormSubmission = await FormSubmission.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true
        }
      )
        .populate('user_id', 'name email thongtin_ksv')
        .populate('case_id', 'vu_an.ma_vu_an vu_an.ten_vu_an')
        .populate('approved_by', 'name email');

      res.status(200).json({
        success: true,
        data: updatedFormSubmission,
        message: 'Form submission updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Xóa form submission
   */
  deleteFormSubmission: async (req, res) => {
    try {
      const formSubmission = await FormSubmission.findById(req.params.id);

      if (!formSubmission) {
        return res.status(404).json({
          success: false,
          message: 'Form submission not found'
        });
      }

      // Chỉ cho phép user tạo form mới được xóa (hoặc admin)
      const userId = req.userId || req.user?._id;
      const isOwner = formSubmission.user_id.toString() === userId?.toString();
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xóa form submission này'
        });
      }

      await FormSubmission.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        data: { message: 'Form submission deleted successfully' },
        message: 'Form submission deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Lấy form submissions theo position (form name)
   */
  getFormSubmissionsByPosition: async (req, res) => {
    try {
      const { position } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const query = { position };
      
      // Filter by user_id nếu có
      if (req.query.user_id) {
        query.user_id = req.query.user_id;
      }
      
      // Filter by status nếu có
      if (req.query.status) {
        query.status = req.query.status;
      }

      const formSubmissions = await FormSubmission.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'name email thongtin_ksv')
        .populate('case_id', 'vu_an.ma_vu_an vu_an.ten_vu_an')
        .populate('approved_by', 'name email');

      const total = await FormSubmission.countDocuments(query);

      res.status(200).json({
        success: true,
        data: formSubmissions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        message: `Form submissions for position '${position}' fetched successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Generate DOCX file từ template và data
   * Body: position, data (object chứa các field để điền vào template)
   * Ví dụ: { position: 'giahantamgiam', data: { vks: 'VKSND TP.HCM', ten_ksv: 'Nguyễn Văn A', ... } }
   * 
   * Cơ chế: Generate DOCX -> Lưu vào server -> Gửi file về client
   */
  generateDocx: async (req, res) => {
    try {
      const { position, data } = req.body;

      console.log('=== generateDocx Request ===');
      console.log('Position:', position);
      console.log('Data keys:', data ? Object.keys(data) : 'No data');
      console.log('Data sample:', data ? JSON.stringify(data, null, 2).substring(0, 500) : 'No data');
      
      // Log riêng cho noi_dung_nhan_thay
      if (data && data.noi_dung_nhan_thay !== undefined) {
        console.log('=== noi_dung_nhan_thay ===');
        console.log('Type:', typeof data.noi_dung_nhan_thay);
        console.log('Value:', data.noi_dung_nhan_thay);
        console.log('Length:', data.noi_dung_nhan_thay ? data.noi_dung_nhan_thay.length : 0);
        console.log('Is empty?', !data.noi_dung_nhan_thay || data.noi_dung_nhan_thay.trim() === '');
        if (data.noi_dung_nhan_thay && data.noi_dung_nhan_thay.trim() !== '') {
          console.log('Preview:', data.noi_dung_nhan_thay.substring(0, 200));
        }
      } else {
        console.log('=== noi_dung_nhan_thay ===');
        console.log('NOT FOUND in data');
      }

      // Validate required fields
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

      // Get user ID từ request (nếu có)
      const userId = req.userId || req.user?._id || null;

      console.log('Generating DOCX for position:', position);
      
      // Generate và lưu DOCX vào server
      const fileInfo = DocxService.generateAndSaveDocx(position, data, userId);
      
      console.log('DOCX generated successfully:', {
        fileName: fileInfo.fileName,
        size: fileInfo.size,
        path: fileInfo.relativePath
      });

      // Lưu thông tin vào database (FormSubmission) nếu có user
      let formSubmission = null;
      if (userId) {
        try {
          formSubmission = await FormSubmission.create({
            position: position,
            content: JSON.stringify(data), // Lưu data dưới dạng JSON string
            user_id: userId,
            status: 'submitted',
            metadata: {
              generated_file: fileInfo.relativePath,
              file_name: fileInfo.fileName,
              file_size: fileInfo.size
            }
          });
        } catch (dbError) {
          // Log lỗi nhưng không block việc gửi file
          console.error('Error saving form submission to database:', dbError);
        }
      }

      // Set headers để download file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`);
      res.setHeader('Content-Length', fileInfo.buffer.length);
      res.setHeader('X-File-Name', encodeURIComponent(fileInfo.fileName));
      res.setHeader('X-File-Path', fileInfo.relativePath); // Thêm header để client biết đường dẫn file

      // Gửi file về client
      res.send(fileInfo.buffer);
    } catch (error) {
      console.error('=== Error in generateDocx ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Position:', req.body?.position);
      console.error('Data keys:', req.body?.data ? Object.keys(req.body.data) : 'No data');
      
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi tạo file DOCX',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  /**
   * Lấy danh sách các template có sẵn
   */
  getAvailableTemplates: async (req, res) => {
    try {
      const templates = DocxService.getAvailableTemplates();

      res.status(200).json({
        success: true,
        data: templates,
        message: 'Available templates fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Convert HTML sang DOCX
   * Body: html (string), fileName (optional)
   */
  htmlToDocx: async (req, res) => {
    try {
      const { html, fileName } = req.body;

      // Validate required fields
      if (!html || typeof html !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'HTML content là bắt buộc và phải là string'
        });
      }

      // Xử lý HTML để đảm bảo font-size được giữ lại khi convert sang DOCX
      let processedHtml = html;
      
      // Hàm chuyển đổi px sang pt (1pt = 4/3px ở 96 DPI)
      const pxToPt = (px) => {
        const pxValue = parseFloat(px);
        if (isNaN(pxValue)) return px;
        // Chuyển đổi: 1pt = 4/3px, làm tròn đến 0.5
        const ptValue = (pxValue * 3) / 4;
        return Math.round(ptValue * 2) / 2;
      };

      // 1. Chuyển đổi tất cả font-size từ px sang pt trong inline styles
      processedHtml = processedHtml.replace(/style="([^"]*)"/gi, (match, styleContent) => {
        let newStyle = styleContent.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, (m, pxValue) => {
          const pt = pxToPt(pxValue);
          return `font-size: ${pt}pt`;
        });
        return `style="${newStyle}"`;
      });

      // 2. Chuyển đổi font-size trong style tags và CSS rules
      processedHtml = processedHtml.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, (match, pxValue) => {
        const pt = pxToPt(pxValue);
        return `font-size: ${pt}pt`;
      });

      // 3. Đảm bảo body có font-size mặc định 14pt nếu chưa có
      // TinyMCE thường set font-size: 14pt trong content_style nhưng có thể bị mất khi convert
      if (processedHtml.includes('<body')) {
        processedHtml = processedHtml.replace(/<body([^>]*)>/i, (match, attrs) => {
          if (attrs && attrs.includes('style=')) {
            // Nếu đã có style, kiểm tra xem có font-size chưa
            return match.replace(/style="([^"]*)"/i, (m, style) => {
              if (!style.includes('font-size')) {
                return `style="${style}; font-size: 14pt"`;
              }
              return m;
            });
          }
          // Nếu chưa có style, thêm style với font-size
          return `<body${attrs} style="font-size: 14pt">`;
        });
      } else {
        // Nếu không có body tag, wrap trong div với style
        if (!processedHtml.includes('font-size')) {
          processedHtml = `<div style="font-size: 14pt">${processedHtml}</div>`;
        }
      }

      // 4. Đảm bảo HTML có đầy đủ structure (DOCTYPE, html, body tags) như yêu cầu của html-docx-js
      // html-docx-js yêu cầu "complete, valid HTML (including DOCTYPE, html and body tags)"
      if (!processedHtml.includes('<!DOCTYPE')) {
        // Nếu chưa có body tag, wrap trong body
        if (!processedHtml.includes('<body')) {
          processedHtml = `<body style="font-size: 14pt; font-family: 'Times New Roman', Times, serif;">${processedHtml}</body>`;
        }
        // Wrap trong html tag nếu chưa có
        if (!processedHtml.includes('<html')) {
          processedHtml = `<html>${processedHtml}</html>`;
        }
        // Thêm DOCTYPE
        processedHtml = `<!DOCTYPE html>${processedHtml}`;
      }

      // 5. Đảm bảo body có font-size nếu chưa có (sau khi đã wrap)
      processedHtml = processedHtml.replace(/<body([^>]*)>/i, (match, attrs) => {
        if (attrs && attrs.includes('style=')) {
          return match.replace(/style="([^"]*)"/i, (m, style) => {
            if (!style.includes('font-size')) {
              return `style="${style}; font-size: 14pt"`;
            }
            return m;
          });
        }
        return `<body${attrs} style="font-size: 14pt">`;
      });

      // Convert HTML sang DOCX với options để đảm bảo formatting được giữ lại
      const docxBlob = await htmlDocx.asBlob(processedHtml, {
        orientation: 'portrait',
        margins: {
          top: 1440,    // 1 inch = 1440 twips
          right: 1440,
          bottom: 1440,
          left: 1440
        }
      });

      // Convert Blob sang Buffer
      const arrayBuffer = await docxBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Tạo tên file
      const finalFileName = fileName || `document_${Date.now()}.docx`;

      // Set headers để download file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFileName)}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('X-File-Name', finalFileName);

      // Gửi file về client
      res.send(buffer);
    } catch (error) {
      console.error('Error converting HTML to DOCX:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể convert HTML sang DOCX'
      });
    }
  },

  /**
   * Parse DOCX template gốc (không có data) sang HTML để xem trước
   * Body: position
   * Trả về HTML từ template DOCX gốc
   */
  parseDocxTemplateToHtml: async (req, res) => {
    try {
      const { position } = req.body;

      // Validate required fields
      if (!position) {
        return res.status(400).json({
          success: false,
          message: 'Position là bắt buộc'
        });
      }

      // Lấy đường dẫn template
      const templateMap = {
        'giahantamgiam': path.join(__dirname, '../forms/dieutra/bao_cao_gia_han_dieu_tra.docx'),
        'quyetdinhgiahantamgiam': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_tam_giam.docx'),
        'quyetdinhgiahandieutra': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_dieu_tra.docx'),
        'baocaogiahan_tam_giam': path.join(__dirname, '../forms/dieutra/QĐ_GIAHANTAMGIAM/bao_cao_gia_han_tam_giam.docx'),
      };

      const templatePath = templateMap[position];
      if (!templatePath) {
        return res.status(400).json({
          success: false,
          message: `Template không tồn tại cho position: ${position}`
        });
      }

      // Debug: Log đường dẫn
      console.log('Template path:', templatePath);
      console.log('__dirname:', __dirname);
      console.log('File exists:', fs.existsSync(templatePath));

      // Kiểm tra file template có tồn tại không
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({
          success: false,
          message: `File template không tồn tại: ${templatePath}`,
          debug: {
            __dirname: __dirname,
            templatePath: templatePath,
            exists: fs.existsSync(templatePath)
          }
        });
      }

      // Đọc file template gốc
      const templateBuffer = fs.readFileSync(templatePath);

      // Parse DOCX XML để lấy alignment
      const zip = new PizZip(templateBuffer);
      const documentXml = zip.files['word/document.xml'].asText();
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      // Parse styles.xml
      let styleDefinitions = {};
      if (zip.files['word/styles.xml']) {
        try {
          const stylesXml = zip.files['word/styles.xml'].asText();
          const stylesDoc = parser.parseFromString(stylesXml, 'text/xml');
          const styles = stylesDoc.getElementsByTagName('w:style');
          
          for (let i = 0; i < styles.length; i++) {
            const style = styles[i];
            const styleId = style.getAttribute('w:styleId');
            const pPr = style.getElementsByTagName('w:pPr')[0];
            
            if (styleId && pPr) {
              const jc = pPr.getElementsByTagName('w:jc')[0];
              if (jc) {
                const val = jc.getAttribute('w:val');
                styleDefinitions[styleId] = { alignment: val };
              }
            }
          }
        } catch (e) {
          console.warn('Could not parse styles.xml:', e.message);
        }
      }
      
      // Lấy paragraph properties
      const paragraphs = doc.getElementsByTagName('w:p');
      const paragraphProperties = [];
      
      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const pPr = para.getElementsByTagName('w:pPr')[0];
        const props = {
          alignment: null,
          spacing: null,
          indentation: null,
        };
        
        if (pPr) {
          const jc = pPr.getElementsByTagName('w:jc')[0];
          if (jc) {
            const val = jc.getAttribute('w:val');
            if (val === 'center') {
              props.alignment = 'center';
            } else if (val === 'right') {
              props.alignment = 'right';
            } else if (val === 'both') {
              props.alignment = 'justify';
            } else if (val === 'end') {
              props.alignment = 'right';
            }
          } else {
            const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
            if (pStyle) {
              const styleId = pStyle.getAttribute('w:val');
              if (styleId && styleDefinitions[styleId] && styleDefinitions[styleId].alignment) {
                const styleAlign = styleDefinitions[styleId].alignment;
                if (styleAlign === 'center') {
                  props.alignment = 'center';
                } else if (styleAlign === 'right' || styleAlign === 'end') {
                  props.alignment = 'right';
                } else if (styleAlign === 'both') {
                  props.alignment = 'justify';
                }
              }
            }
          }
        }
        
        paragraphProperties.push(props);
      }

      // Parse với mammoth
      const result = await mammoth.convertToHtml(
        { buffer: templateBuffer },
        {
          styleMap: [
            "p[style-name='Normal'] => p:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          includeDefaultStyleMap: true,
          preserveEmptyParagraphs: true,
        }
      );

      let html = result.value;
      
      // Merge alignment từ XML
      let paraIndex = 0;
      html = html.replace(/<p([^>]*)>/gi, (match, attrs) => {
        const props = paraIndex < paragraphProperties.length 
          ? paragraphProperties[paraIndex] 
          : { alignment: null };
        paraIndex++;
        
        let existingStyle = '';
        if (attrs.includes('style=')) {
          const styleMatch = attrs.match(/style="([^"]*)"/i);
          if (styleMatch) {
            existingStyle = styleMatch[1];
          }
        }
        
        const styleObj = {};
        if (existingStyle) {
          existingStyle.split(';').forEach(style => {
            const [key, value] = style.split(':').map(s => s.trim());
            if (key && value) {
              styleObj[key] = value;
            }
          });
        }
        
        if (props.alignment !== null && props.alignment !== undefined) {
          if (props.alignment !== 'left') {
            styleObj['text-align'] = props.alignment;
          } else {
            if (styleObj['text-align'] && styleObj['text-align'] !== 'left') {
              delete styleObj['text-align'];
            }
          }
        }
        
        if (!styleObj['font-family']) {
          styleObj['font-family'] = "'Times New Roman', Times, serif";
        }
        if (!styleObj['font-size']) {
          styleObj['font-size'] = '14pt';
        }
        
        const mergedStyle = Object.entries(styleObj)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ');
        
        if (attrs.includes('style=')) {
          return match.replace(/style="([^"]*)"/i, `style="${mergedStyle}"`);
        } else {
          return `<p${attrs} style="${mergedStyle}">`;
        }
      });

      res.status(200).json({
        success: true,
        data: {
          html: html,
          messages: result.messages || []
        },
        message: 'DOCX template parsed to HTML successfully'
      });
    } catch (error) {
      console.error('Error parsing DOCX template to HTML:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể parse DOCX template sang HTML'
      });
    }
  },

  /**
   * Parse HTML template và điền data vào
   * Body: position, data (object chứa các field để điền vào template)
   * Trả về HTML đã được điền data từ file HTML template
   */
  parseDocxToHtml: async (req, res) => {
    try {
      const { position, data } = req.body;

      // Validate required fields
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

      // Lấy đường dẫn HTML template
      const templateMap = {
        'giahantamgiam': path.join(__dirname, '../forms/dieutra/bao_cao_gia_han_dieu_tra.html'),
        'quyetdinhgiahantamgiam': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_tam_giam.html'),
        'quyetdinhgiahandieutra': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_dieu_tra.html'),
        'baocaogiahan_tam_giam': path.join(__dirname, '../forms/dieutra/QĐ_GIAHANTAMGIAM/bao_cao_gia_han_tam_giam.html'),
      };

      const templatePath = templateMap[position];
      if (!templatePath) {
        return res.status(400).json({
          success: false,
          message: `Template không tồn tại cho position: ${position}`
        });
      }

      // Kiểm tra file template có tồn tại không
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({
          success: false,
          message: `File template không tồn tại: ${templatePath}`
        });
      }

      // Đọc file HTML template
      let html = fs.readFileSync(templatePath, 'utf-8');

      // Điền data vào HTML bằng cách replace các placeholder {key}
      // Escape các giá trị để tránh XSS và giữ format HTML
      Object.keys(data).forEach(key => {
        const value = data[key];
        // Nếu value là null hoặc undefined, thay bằng chuỗi rỗng
        const safeValue = value != null ? String(value) : '';
        // Replace tất cả các placeholder {key} với giá trị
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        html = html.replace(regex, safeValue);
      });

      res.status(200).json({
        success: true,
        data: {
          html: html,
          messages: []
        },
        message: 'HTML template parsed and filled successfully'
      });
    } catch (error) {
      console.error('Error parsing HTML template:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể parse HTML template'
      });
    }
  },

  /**
   * Parse DOCX sang HTML với format được giữ lại từ template (DEPRECATED - giữ lại để tương thích)
   * Body: position, data (object chứa các field để điền vào template)
   * Trả về HTML đã được format đúng từ template DOCX
   */
  parseDocxToHtmlOld: async (req, res) => {
    try {
      const { position, data } = req.body;

      // Validate required fields
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

      // Generate DOCX từ template
      const buffer = DocxService.generateDocxFromForm(position, data);

      // BƯỚC 1: Parse DOCX XML trực tiếp để lấy TẤT CẢ format properties
      const zip = new PizZip(buffer);
      const documentXml = zip.files['word/document.xml'].asText();
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      // Parse styles.xml để lấy style definitions (có thể có alignment ở style level)
      let styleDefinitions = {};
      if (zip.files['word/styles.xml']) {
        try {
          const stylesXml = zip.files['word/styles.xml'].asText();
          const stylesDoc = parser.parseFromString(stylesXml, 'text/xml');
          const styles = stylesDoc.getElementsByTagName('w:style');
          
          for (let i = 0; i < styles.length; i++) {
            const style = styles[i];
            const styleId = style.getAttribute('w:styleId');
            const pPr = style.getElementsByTagName('w:pPr')[0];
            
            if (styleId && pPr) {
              const jc = pPr.getElementsByTagName('w:jc')[0];
              if (jc) {
                const val = jc.getAttribute('w:val');
                styleDefinitions[styleId] = { alignment: val };
              }
            }
          }
        } catch (e) {
          console.warn('Could not parse styles.xml:', e.message);
        }
      }
      
      // Lấy tất cả paragraphs và các properties của chúng
      const paragraphs = doc.getElementsByTagName('w:p');
      const paragraphProperties = [];
      
      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const pPr = para.getElementsByTagName('w:pPr')[0];
        const props = {
          alignment: null,
          spacing: null,
          indentation: null,
        };
        
        if (pPr) {
          // Alignment - kiểm tra cả paragraph level và style level
          // QUAN TRỌNG: Chỉ set alignment nếu thực sự có trong XML
          // Nếu không có, để null (không set 'left' mặc định)
          const jc = pPr.getElementsByTagName('w:jc')[0];
          if (jc) {
            const val = jc.getAttribute('w:val');
            if (val === 'center') {
              props.alignment = 'center';
            } else if (val === 'right') {
              props.alignment = 'right';
            } else if (val === 'both') {
              props.alignment = 'justify';
            } else if (val === 'end') {
              props.alignment = 'right';
            } 
            // KHÔNG set 'left' mặc định - chỉ set khi thực sự có 'left' hoặc 'start'
            // Nếu không có jc hoặc val không phải các giá trị trên, để null
          } else {
            // Nếu không có alignment ở paragraph level, kiểm tra style
            const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
            if (pStyle) {
              const styleId = pStyle.getAttribute('w:val');
              if (styleId && styleDefinitions[styleId] && styleDefinitions[styleId].alignment) {
                const styleAlign = styleDefinitions[styleId].alignment;
                if (styleAlign === 'center') {
                  props.alignment = 'center';
                } else if (styleAlign === 'right' || styleAlign === 'end') {
                  props.alignment = 'right';
                } else if (styleAlign === 'both') {
                  props.alignment = 'justify';
                }
                // KHÔNG set 'left' mặc định từ style
              }
            }
          }
          
          // Spacing (line spacing, before, after)
          const spacing = pPr.getElementsByTagName('w:spacing')[0];
          if (spacing) {
            props.spacing = {
              before: spacing.getAttribute('w:before'),
              after: spacing.getAttribute('w:after'),
              line: spacing.getAttribute('w:line'),
              lineRule: spacing.getAttribute('w:lineRule'),
            };
          }
          
          // Indentation
          const ind = pPr.getElementsByTagName('w:ind')[0];
          if (ind) {
            props.indentation = {
              left: ind.getAttribute('w:left'),
              right: ind.getAttribute('w:right'),
              firstLine: ind.getAttribute('w:firstLine'),
              hanging: ind.getAttribute('w:hanging'),
            };
          }
        }
        
        paragraphProperties.push(props);
      }
      
      // Debug: Log số paragraph có alignment
      const withAlignment = paragraphProperties.filter(p => p.alignment && p.alignment !== 'left').length;
      console.log(`Paragraphs with non-left alignment: ${withAlignment} out of ${paragraphProperties.length}`);

      // BƯỚC 2: Parse DOCX sang HTML với mammoth.js để preserve cấu trúc phức tạp (columns, tables, etc.)
      // Sau đó merge alignment từ XML vào HTML
      const result = await mammoth.convertToHtml(
        { buffer: buffer },
        {
          styleMap: [
            "p[style-name='Normal'] => p:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          includeDefaultStyleMap: true,
          preserveEmptyParagraphs: true,
        }
      );

      let html = result.value;
      
      // BƯỚC 3: Merge alignment từ XML vào HTML từ mammoth
      // Map alignment từ XML vào các paragraph trong HTML
      let paraIndex = 0;
      html = html.replace(/<p([^>]*)>/gi, (match, attrs) => {
        // Lấy alignment từ XML cho paragraph này
        const props = paraIndex < paragraphProperties.length 
          ? paragraphProperties[paraIndex] 
          : { alignment: null };
        paraIndex++;
        
        // Lấy style hiện tại từ mammoth
        let existingStyle = '';
        if (attrs.includes('style=')) {
          const styleMatch = attrs.match(/style="([^"]*)"/i);
          if (styleMatch) {
            existingStyle = styleMatch[1];
          }
        }
        
        // Parse style thành object
        const styleObj = {};
        if (existingStyle) {
          existingStyle.split(';').forEach(style => {
            const [key, value] = style.split(':').map(s => s.trim());
            if (key && value) {
              styleObj[key] = value;
            }
          });
        }
        
        // QUAN TRỌNG: Ưu tiên alignment từ XML (nguồn chính xác nhất)
        // Nếu XML có alignment (không null, không undefined) => DÙNG XML
        if (props.alignment !== null && props.alignment !== undefined) {
          if (props.alignment !== 'left') {
            // XML có alignment khác left => DÙNG XML (ghi đè mammoth)
            styleObj['text-align'] = props.alignment;
          } else {
            // XML có alignment là 'left' => Xóa alignment nếu mammoth có alignment khác
            if (styleObj['text-align'] && styleObj['text-align'] !== 'left') {
              delete styleObj['text-align'];
            }
          }
        }
        // Nếu XML không có alignment => Giữ nguyên mammoth
        
        // Đảm bảo có font-family và font-size
        if (!styleObj['font-family']) {
          styleObj['font-family'] = "'Times New Roman', Times, serif";
        }
        if (!styleObj['font-size']) {
          styleObj['font-size'] = '14pt';
        }
        
        // Convert back to string
        const mergedStyle = Object.entries(styleObj)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ');
        
        // Cập nhật hoặc thêm style attribute
        if (attrs.includes('style=')) {
          return match.replace(/style="([^"]*)"/i, `style="${mergedStyle}"`);
        } else {
          return `<p${attrs} style="${mergedStyle}">`;
        }
      });
      
      // Debug: Log một số paragraph đầu tiên
      const firstParagraphs = html.match(/<p[^>]*>.*?<\/p>/gi)?.slice(0, 5) || [];
      console.log('=== FIRST 5 PARAGRAPHS AFTER MERGE ===');
      firstParagraphs.forEach((p, i) => {
        console.log(`Paragraph ${i}:`, p.substring(0, 200));
      });
      console.log('=== END FIRST 5 PARAGRAPHS ===');

      res.status(200).json({
        success: true,
        data: {
          html: html,
          messages: result.messages || []
        },
        message: 'DOCX parsed to HTML successfully'
      });
    } catch (error) {
      console.error('Error parsing DOCX to HTML:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể parse DOCX sang HTML'
      });
    }
  }
};

/**
 * Parse DOCX XML trực tiếp sang HTML để preserve 100% format
 * Helper function bên ngoài object
 */
function parseDocxXmlToHtml(doc, paragraphProperties, styleDefinitions) {
    try {
      let html = '';
      const paragraphs = doc.getElementsByTagName('w:p');
    
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const props = paragraphProperties[i] || { alignment: null, spacing: null, indentation: null };
      
      // Build style string từ properties
      let styleStr = "font-family: 'Times New Roman', Times, serif; font-size: 14pt;";
      
      // Alignment - CHỈ thêm nếu có và không phải left
      if (props.alignment && props.alignment !== 'left') {
        styleStr += ` text-align: ${props.alignment};`;
      }
      
      // Spacing
      if (props.spacing) {
        if (props.spacing.before) {
          const beforePt = parseInt(props.spacing.before) / 20;
          styleStr += ` margin-top: ${beforePt}pt;`;
        }
        if (props.spacing.after) {
          const afterPt = parseInt(props.spacing.after) / 20;
          styleStr += ` margin-bottom: ${afterPt}pt;`;
        }
        if (props.spacing.line) {
          const lineValue = parseInt(props.spacing.line);
          if (props.spacing.lineRule === 'auto') {
            styleStr += ` line-height: ${lineValue / 240};`;
          } else {
            styleStr += ` line-height: ${lineValue / 20}pt;`;
          }
        }
      }
      
      // Indentation
      if (props.indentation) {
        if (props.indentation.left) {
          const leftPt = parseInt(props.indentation.left) / 20;
          styleStr += ` margin-left: ${leftPt}pt;`;
        }
        if (props.indentation.right) {
          const rightPt = parseInt(props.indentation.right) / 20;
          styleStr += ` margin-right: ${rightPt}pt;`;
        }
        if (props.indentation.firstLine) {
          const firstLinePt = parseInt(props.indentation.firstLine) / 20;
          styleStr += ` text-indent: ${firstLinePt}pt;`;
        }
      }
      
      // Parse runs (w:r) và breaks (w:br) trong paragraph
      const runs = para.getElementsByTagName('w:r');
      const breaks = para.getElementsByTagName('w:br');
      let paraText = '';
      
      // Xử lý runs
      for (let j = 0; j < runs.length; j++) {
        const run = runs[j];
        const textNodes = run.getElementsByTagName('w:t');
        
        // Lấy text từ tất cả text nodes trong run này
        let runText = '';
        for (let k = 0; k < textNodes.length; k++) {
          const textNode = textNodes[k];
          let text = textNode.textContent || '';
          // Escape HTML
          text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          runText += text;
        }
        
        // Check formatting (bold, italic, etc.) cho run này
        if (runText) {
          const rPr = run.getElementsByTagName('w:rPr')[0];
          if (rPr) {
            const isBold = rPr.getElementsByTagName('w:b').length > 0;
            const isItalic = rPr.getElementsByTagName('w:i').length > 0;
            const isUnderline = rPr.getElementsByTagName('w:u').length > 0;
            
            // Wrap text với formatting tags
            let formattedText = runText;
            if (isBold) formattedText = `<strong>${formattedText}</strong>`;
            if (isItalic) formattedText = `<em>${formattedText}</em>`;
            if (isUnderline) formattedText = `<u>${formattedText}</u>`;
            
            paraText += formattedText;
          } else {
            // Không có formatting, thêm text trực tiếp
            paraText += runText;
          }
        }
      }
      
      // Xử lý line breaks
      if (breaks.length > 0) {
        paraText += '<br>';
      }
      
      // Tạo paragraph HTML
      html += `<p style="${styleStr}">${paraText || '&nbsp;'}</p>\n`;
    }
    
    // Xử lý tables nếu có
    const tables = doc.getElementsByTagName('w:tbl');
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      html += '<table style="width: 100%; border-collapse: collapse;">\n';
      
      const rows = table.getElementsByTagName('w:tr');
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        html += '<tr>\n';
        
        const cells = row.getElementsByTagName('w:tc');
        for (let k = 0; k < cells.length; k++) {
          const cell = cells[k];
          const cellParas = cell.getElementsByTagName('w:p');
          let cellText = '';
          
          for (let l = 0; l < cellParas.length; l++) {
            const cellPara = cellParas[l];
            const cellRuns = cellPara.getElementsByTagName('w:r');
            for (let m = 0; m < cellRuns.length; m++) {
              const cellRun = cellRuns[m];
              const cellTextNodes = cellRun.getElementsByTagName('w:t');
              for (let n = 0; n < cellTextNodes.length; n++) {
                let text = cellTextNodes[n].textContent || '';
                text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                cellText += text;
              }
            }
            if (l < cellParas.length - 1) cellText += '<br>';
          }
          
          html += `<td style="font-family: 'Times New Roman', Times, serif; font-size: 14pt; padding: 4px; border: 1px solid #000;">${cellText || '&nbsp;'}</td>\n`;
        }
        
        html += '</tr>\n';
      }
      
      html += '</table>\n';
    }
    
    return html;
    } catch (error) {
      console.error('Error in parseDocxXmlToHtml:', error);
      throw new Error(`Error parsing DOCX XML to HTML: ${error.message}`);
    }
}

export default FormSubmissionController;


