import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service để xử lý DOCX template với docxtemplater
 */
class DocxService {
  /**
   * Generate DOCX file từ template và data
   * @param {string} templatePath - Đường dẫn đến file template
   * @param {Object} data - Data object để điền vào template
   * @returns {Buffer} - Buffer của file DOCX đã được điền data
   */
  static generateDocx(templatePath, data) {
    try {
      // Đọc file template
      const templateBuffer = fs.readFileSync(templatePath, 'binary');
      
      // Tạo PizZip instance từ template
      const zip = new PizZip(templateBuffer);
      
      // Tạo Docxtemplater instance
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Điền data vào template
      doc.setData(data);
      
      // Render document
      doc.render();

      // Lấy buffer của file đã render
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return buffer;
    } catch (error) {
      // Xử lý lỗi từ docxtemplater
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((e) => e.properties.explanation)
          .join('\n');
        throw new Error(`DocxTemplate Error: ${errorMessages}`);
      }
      throw new Error(`Error generating DOCX: ${error.message}`);
    }
  }

  /**
   * Generate DOCX từ template trong thư mục forms
   * @param {string} position - Position/Form name (ví dụ: 'giahantamgiam')
   * @param {Object} data - Data object để điền vào template
   * @returns {Buffer} - Buffer của file DOCX đã được điền data
   */
  static generateDocxFromForm(position, data) {
    // Đường dẫn đến file template
    // Ví dụ: forms/dieutra/bao_cao_gia_han_dieu_tra.docx cho position 'giahantamgiam'
    let templatePath;
    
    // Map position đến file template
    const templateMap = {
      'giahantamgiam': path.join(__dirname, '../forms/dieutra/bao_cao_gia_han_dieu_tra.docx'),
      'quyetdinhgiahantamgiam': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_tam_giam.docx'),
      'quyetdinhgiahandieutra': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_dieu_tra.docx'),
      'baocaogiahan_tam_giam': path.join(__dirname, '../forms/dieutra/QĐ_GIAHANTAMGIAM/bao_cao_gia_han_tam_giam.docx'),
      // Có thể thêm các form khác ở đây
      // 'baocao': path.join(__dirname, '../forms/dieutra/bao_cao.docx'),
    };

    templatePath = templateMap[position];

    if (!templatePath) {
      throw new Error(`Template không tồn tại cho position: ${position}`);
    }

    // Kiểm tra file template có tồn tại không
    if (!fs.existsSync(templatePath)) {
      throw new Error(`File template không tồn tại: ${templatePath}`);
    }

    return this.generateDocx(templatePath, data);
  }

  /**
   * Generate và lưu DOCX file vào server
   * @param {string} position - Position/Form name
   * @param {Object} data - Data object để điền vào template
   * @param {string} userId - User ID (optional, để tạo thư mục theo user)
   * @returns {Object} - { filePath, fileName, buffer }
   */
  static generateAndSaveDocx(position, data, userId = null) {
    // Tạo buffer từ template
    const buffer = this.generateDocxFromForm(position, data);

    // Tạo thư mục lưu file
    const generatedDocsDir = path.join(__dirname, '../generated-docs');
    
    // Tạo thư mục con theo user nếu có
    const saveDir = userId 
      ? path.join(generatedDocsDir, userId.toString())
      : generatedDocsDir;

    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Tạo tên file unique (position_timestamp_random.docx)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const fileName = `${position}_${timestamp}_${random}.docx`;
    const filePath = path.join(saveDir, fileName);

    // Kiểm tra file đã tồn tại chưa (rất hiếm nhưng để an toàn)
    let finalFilePath = filePath;
    let finalFileName = fileName;
    let counter = 1;
    
    while (fs.existsSync(finalFilePath)) {
      finalFileName = `${position}_${timestamp}_${random}_${counter}.docx`;
      finalFilePath = path.join(saveDir, finalFileName);
      counter++;
    }

    // Lưu file vào disk
    fs.writeFileSync(finalFilePath, buffer);

    // Trả về thông tin file
    return {
      filePath: finalFilePath,
      fileName: finalFileName,
      relativePath: path.relative(path.join(__dirname, '..'), finalFilePath),
      buffer: buffer,
      size: buffer.length
    };
  }

  /**
   * Lấy danh sách các template có sẵn
   * @returns {Array} - Danh sách các position và template path
   */
  static getAvailableTemplates() {
    const templateMap = {
      'giahantamgiam': path.join(__dirname, '../forms/dieutra/bao_cao_gia_han_dieu_tra.docx'),
      'quyetdinhgiahantamgiam': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_tam_giam.docx'),
      'quyetdinhgiahandieutra': path.join(__dirname, '../forms/dieutra/quyet_dinh_gia_han_dieu_tra.docx'),
      'baocaogiahan_tam_giam': path.join(__dirname, '../forms/dieutra/QĐ_GIAHANTAMGIAM/bao_cao_gia_han_tam_giam.docx'),
    };

    const available = [];
    for (const [position, templatePath] of Object.entries(templateMap)) {
      if (fs.existsSync(templatePath)) {
        available.push({
          position,
          templatePath,
          exists: true,
        });
      } else {
        available.push({
          position,
          templatePath,
          exists: false,
        });
      }
    }

    return available;
  }
}

export default DocxService;

