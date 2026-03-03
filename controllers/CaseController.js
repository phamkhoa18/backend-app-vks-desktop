import Case from '../models/Case.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
  },

  /**
   * Extract thông tin vụ án và bị can từ OCR text
   * Sử dụng OpenAI function calling để extract chính xác hơn
   */
  extractCaseInfo: async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Text là bắt buộc'
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          success: false,
          message: 'OPENAI_API_KEY chưa được cấu hình'
        });
      }

      // Định nghĩa function schema cho OpenAI function calling
      const functions = [
        {
          name: 'extract_case_info',
          description: 'Trích xuất thông tin vụ án và bị can từ văn bản pháp lý tiếng Việt',
          parameters: {
            type: 'object',
            properties: {
              vu_an: {
                type: 'object',
                description: 'Thông tin vụ án',
                properties: {
                  ma_vu_an: { type: 'string', description: 'Mã vụ án (nếu có)' },
                  ten_vu_an: { type: 'string', description: 'Tên vụ án' },
                  ma_cqdt: { type: 'string', description: 'Mã cơ quan điều tra' },
                  so_cong_van_de_nghi: { type: 'string', description: 'Số công văn đề nghị' },
                  ngay_cong_van: { type: 'string', description: 'Ngày công văn (format: DD/MM/YYYY)' },
                  noi_dung_vu_viec: { type: 'string', description: 'Nội dung vụ việc' },
                  trang_thai: {
                    type: 'string',
                    enum: ['khoi_to', 'dang_dieu_tra', 'da_truy_to', 'dang_xet_xu', 'da_ket_thuc'],
                    description: 'Trạng thái vụ án'
                  },
                  thoi_han_tam_giam: { type: 'string', description: 'Thời hạn tạm giam' },
                  so_quyet_dinh_khoi_to_vu_an: { type: 'string', description: 'Số quyết định khởi tố vụ án' },
                  ngay_khoi_to_vu_an: { type: 'string', description: 'Ngày khởi tố vụ án (format: DD/MM/YYYY)' },
                  co_quan_khoi_to: { type: 'string', description: 'Cơ quan khởi tố' },
                  ngay_phan_cong_vu_an: { type: 'string', description: 'Ngày phân công vụ án (format: DD/MM/YYYY)' },
                  ngay_xay_ra: { type: 'string', description: 'Ngày xảy ra vụ án (format: DD/MM/YYYY)' },
                  dia_diem_vu_an: { type: 'string', description: 'Địa điểm xảy ra vụ án' },
                  toidanh: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Danh sách tội danh'
                  },
                  dieu_khoan_diem: {
                    type: 'array',
                    description: 'Điều khoản áp dụng cho vụ án',
                    items: {
                      type: 'object',
                      properties: {
                        dieu: { type: 'number', description: 'Số điều' },
                        khoan: { type: 'number', description: 'Số khoản (0 nếu không có)' },
                        diem: { type: 'string', description: 'Điểm (khoản chữ, ví dụ: a, b, c)' },
                        bo_luat: { type: 'string', enum: ['BLHS', 'BLTTHS'], description: 'Bộ luật' },
                        ten_toi_danh: { type: 'string', description: 'Tên tội danh' }
                      },
                      required: ['dieu', 'bo_luat']
                    }
                  }
                }
              },
              bi_can: {
                type: 'array',
                description: 'Danh sách bị can',
                items: {
                  type: 'object',
                  properties: {
                    ho_ten: { type: 'string', description: 'Họ và tên (bắt buộc)' },
                    ten_goi_khac: { type: 'string', description: 'Tên gọi khác' },
                    ngay_sinh: { type: 'string', description: 'Ngày sinh (format: DD/MM/YYYY)' },
                    gioi_tinh: { type: 'string', enum: ['Nam', 'Nữ'], description: 'Giới tính' },
                    noi_sinh: { type: 'string', description: 'Nơi sinh' },
                    thuong_tru: { type: 'string', description: 'Thường trú' },
                    tam_tru: { type: 'string', description: 'Tạm trú' },
                    nghe_nghiep: { type: 'string', description: 'Nghề nghiệp' },
                    trinh_do_hoc_van: { type: 'string', description: 'Trình độ học vấn' },
                    quoc_tich: { type: 'string', description: 'Quốc tịch' },
                    dan_toc: { type: 'string', description: 'Dân tộc' },
                    ton_giao: { type: 'string', description: 'Tôn giáo' },
                    cccd: { type: 'string', description: 'Số CCCD/CMND' },
                    ngay_cap_cccd: { type: 'string', description: 'Ngày cấp CCCD' },
                    noi_cap_cccd: { type: 'string', description: 'Nơi cấp CCCD' },
                    tinh_trang_ngan_chan: {
                      type: 'string',
                      enum: ['tu_do', 'tam_giu', 'tam_giam', 'cam_di_khoi_noi_cu_tru'],
                      description: 'Tình trạng ngăn chặn'
                    },
                    thoi_diem_bat_giu: { type: 'string', description: 'Thời điểm bắt giữ' },
                    toi_danh_ca_nhan: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Tội danh cá nhân'
                    },
                    dieu_khoan_diem: {
                      type: 'array',
                      description: 'Điều khoản áp dụng cho bị can',
                      items: {
                        type: 'object',
                        properties: {
                          dieu: { type: 'number' },
                          khoan: { type: 'number' },
                          diem: { type: 'string' },
                          bo_luat: { type: 'string', enum: ['BLHS', 'BLTTHS'] },
                          ten_toi_danh: { type: 'string' }
                        },
                        required: ['dieu', 'bo_luat']
                      }
                    },
                    chung_cu: { type: 'string', description: 'Chứng cứ' },
                    ghi_chu: { type: 'string', description: 'Ghi chú' },
                    ho_ten_cha: { type: 'string', description: 'Họ tên cha' },
                    nam_sinh_cha: { type: 'string', description: 'Năm sinh cha' },
                    cha_da_mat: { type: 'boolean', description: 'Cha đã mất' },
                    ho_ten_me: { type: 'string', description: 'Họ tên mẹ' },
                    nam_sinh_me: { type: 'string', description: 'Năm sinh mẹ' },
                    me_da_mat: { type: 'boolean', description: 'Mẹ đã mất' },
                    vo_chong: {
                      type: 'object',
                      description: 'Thông tin vợ/chồng',
                      properties: {
                        ho_ten: { type: 'string', description: 'Họ tên vợ/chồng' },
                        nam_sinh: { type: 'string', description: 'Năm sinh' },
                        da_mat: { type: 'boolean', description: 'Đã mất' },
                        loai: { type: 'string', enum: ['vo', 'chong'], description: 'Loại: vợ hoặc chồng' }
                      }
                    },
                    con_ruot: {
                      type: 'array',
                      description: 'Danh sách con ruột',
                      items: {
                        type: 'object',
                        properties: {
                          ho_ten: { type: 'string', description: 'Họ tên con' },
                          nam_sinh: { type: 'string', description: 'Năm sinh' }
                        }
                      }
                    },
                    tien_su: { type: 'string', description: 'Tiền sự' },
                    tien_an: {
                      type: 'array',
                      description: 'Danh sách tiền án',
                      items: {
                        type: 'object',
                        properties: {
                          so_luong: { type: 'number', description: 'Số lượng tiền án' },
                          ngay: { type: 'string', description: 'Ngày (format: DD/MM/YYYY)' },
                          co_quan: { type: 'string', description: 'Cơ quan xét xử (Tòa án)' },
                          hinh_phat: { type: 'string', description: 'Hình phạt' },
                          toi_danh: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Tội danh'
                          },
                          thoi_gian_chap_hanh: { type: 'string', description: 'Thời gian chấp hành' }
                        }
                      }
                    }
                  },
                  required: ['ho_ten']
                }
              }
            },
            required: ['vu_an', 'bi_can']
          }
        }
      ];

      const systemPrompt = `Bạn là một chuyên gia pháp lý chuyên trích xuất thông tin từ văn bản pháp lý tiếng Việt. Hãy trích xuất thông tin một cách chính xác và đầy đủ nhất có thể.

Lưu ý quan trọng:
- Điều khoản phải parse chính xác: điều, khoản, điểm, bộ luật
- Ngày tháng giữ nguyên format trong văn bản hoặc convert sang DD/MM/YYYY
- Tội danh là array, có thể có nhiều tội danh
- Nếu không tìm thấy thông tin, để null hoặc array rỗng
- Tiền án tiền sự cần extract chi tiết từ các thông tin như "đã bị xử phạt", "đã chấp hành án", v.v.`;

      const userPrompt = `Hãy trích xuất thông tin từ văn bản pháp lý sau:\n\n${text}`;

      // Gọi OpenAI API với function calling
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        functions: functions,
        function_call: { name: 'extract_case_info' },
        temperature: 0.3
      });

      // Lấy kết quả từ function call
      const functionCall = completion.choices[0].message.function_call;
      if (!functionCall || functionCall.name !== 'extract_case_info') {
        throw new Error('OpenAI không trả về function call đúng format');
      }

      const extractedData = JSON.parse(functionCall.arguments);

      // Validate và format dữ liệu
      const formattedData = {
        vu_an: {
          ma_vu_an: extractedData.vu_an?.ma_vu_an || '',
          ten_vu_an: extractedData.vu_an?.ten_vu_an || '',
          ma_cqdt: extractedData.vu_an?.ma_cqdt || '',
          so_cong_van_de_nghi: extractedData.vu_an?.so_cong_van_de_nghi || '',
          ngay_cong_van: extractedData.vu_an?.ngay_cong_van || '',
          noi_dung_vu_viec: extractedData.vu_an?.noi_dung_vu_viec || '',
          trang_thai: extractedData.vu_an?.trang_thai || 'khoi_to',
          thoi_han_tam_giam: extractedData.vu_an?.thoi_han_tam_giam || '',
          so_quyet_dinh_khoi_to_vu_an: extractedData.vu_an?.so_quyet_dinh_khoi_to_vu_an || '',
          ngay_khoi_to_vu_an: extractedData.vu_an?.ngay_khoi_to_vu_an || '',
          co_quan_khoi_to: extractedData.vu_an?.co_quan_khoi_to || '',
          ngay_phan_cong_vu_an: extractedData.vu_an?.ngay_phan_cong_vu_an || '',
          ngay_xay_ra: extractedData.vu_an?.ngay_xay_ra || '',
          dia_diem_vu_an: extractedData.vu_an?.dia_diem_vu_an || '',
          toidanh: extractedData.vu_an?.toidanh || [],
          dieu_khoan_diem: (extractedData.vu_an?.dieu_khoan_diem || []).map(item => ({
            dieu: item.dieu || 0,
            khoan: item.khoan || 0,
            diem: item.diem || '',
            bo_luat: item.bo_luat || 'BLHS',
            ten_toi_danh: item.ten_toi_danh || ''
          }))
        },
        bi_can: (extractedData.bi_can || []).map(biCan => ({
          ho_ten: biCan.ho_ten || '',
          ten_goi_khac: biCan.ten_goi_khac || '',
          ngay_sinh: biCan.ngay_sinh || '',
          gioi_tinh: biCan.gioi_tinh || 'Nam',
          noi_sinh: biCan.noi_sinh || '',
          thuong_tru: biCan.thuong_tru || '',
          tam_tru: biCan.tam_tru || '',
          nghe_nghiep: biCan.nghe_nghiep || '',
          trinh_do_hoc_van: biCan.trinh_do_hoc_van || '',
          quoc_tich: biCan.quoc_tich || 'Việt Nam',
          dan_toc: biCan.dan_toc || 'Kinh',
          ton_giao: biCan.ton_giao || '',
          cccd: biCan.cccd || '',
          ngay_cap_cccd: biCan.ngay_cap_cccd || '',
          noi_cap_cccd: biCan.noi_cap_cccd || '',
          tinh_trang_ngan_chan: biCan.tinh_trang_ngan_chan || 'tu_do',
          thoi_diem_bat_giu: biCan.thoi_diem_bat_giu || '',
          toi_danh_ca_nhan: biCan.toi_danh_ca_nhan || [],
          dieu_khoan_diem: (biCan.dieu_khoan_diem || []).map(item => ({
            dieu: item.dieu || 0,
            khoan: item.khoan || 0,
            diem: item.diem || '',
            bo_luat: item.bo_luat || 'BLHS',
            ten_toi_danh: item.ten_toi_danh || ''
          })),
          chung_cu: biCan.chung_cu || '',
          ghi_chu: biCan.ghi_chu || '',
          ho_ten_cha: biCan.ho_ten_cha || '',
          nam_sinh_cha: biCan.nam_sinh_cha || '',
          cha_da_mat: biCan.cha_da_mat || false,
          ho_ten_me: biCan.ho_ten_me || '',
          nam_sinh_me: biCan.nam_sinh_me || '',
          me_da_mat: biCan.me_da_mat || false,
          vo_chong: biCan.vo_chong ? {
            ho_ten: biCan.vo_chong.ho_ten || '',
            nam_sinh: biCan.vo_chong.nam_sinh || '',
            da_mat: biCan.vo_chong.da_mat || false,
            loai: biCan.vo_chong.loai || 'vo'
          } : undefined,
          con_ruot: (biCan.con_ruot || []).map(c => ({
            ho_ten: c.ho_ten || '',
            nam_sinh: c.nam_sinh || ''
          })),
          tien_su: biCan.tien_su || '',
          tien_an: (biCan.tien_an || []).map(item => ({
            so_luong: item.so_luong || 0,
            ngay: item.ngay || '',
            co_quan: item.co_quan || '',
            hinh_phat: item.hinh_phat || '',
            toi_danh: item.toi_danh || [],
            thoi_gian_chap_hanh: item.thoi_gian_chap_hanh || ''
          }))
        }))
      };

      res.status(200).json({
        success: true,
        data: formattedData,
        message: 'Extract thông tin thành công'
      });
    } catch (error) {
      console.error('Error extracting case info:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi extract thông tin'
      });
    }
  },

  /**
   * Merge bị can vào vụ án hiện có
   * Check duplicate và merge thông tin thông minh
   */
  mergeBiCanToCase: async (req, res) => {
    try {
      const { caseId } = req.params;
      const { bi_can: newBiCanList } = req.body;

      if (!newBiCanList || !Array.isArray(newBiCanList) || newBiCanList.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách bị can là bắt buộc'
        });
      }

      // Lấy vụ án hiện có
      const existingCase = await Case.findById(caseId);
      if (!existingCase) {
        return res.status(404).json({
          success: false,
          message: 'Vụ án không tồn tại'
        });
      }

      // Helper function để normalize string (bỏ dấu, lowercase)
      const normalizeString = (str) => {
        if (!str) return '';
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      };

      // Helper function để check duplicate bị can
      const isDuplicateBiCan = (existing, newBiCan) => {
        // Check CCCD trước (chính xác nhất)
        if (existing.cccd && newBiCan.cccd && existing.cccd === newBiCan.cccd) {
          return true;
        }

        // Check họ tên (normalize)
        const existingName = normalizeString(existing.ho_ten);
        const newName = normalizeString(newBiCan.ho_ten);
        if (existingName && newName && existingName === newName) {
          // Nếu có ngày sinh, check thêm
          if (existing.ngay_sinh && newBiCan.ngay_sinh) {
            const existingDate = new Date(existing.ngay_sinh).toISOString().split('T')[0];
            const newDate = new Date(newBiCan.ngay_sinh).toISOString().split('T')[0];
            if (existingDate === newDate) {
              return true;
            }
          } else {
            // Chỉ có tên giống nhau, coi như duplicate
            return true;
          }
        }

        return false;
      };

      // Merge logic
      const existingBiCan = existingCase.bi_can || [];
      const mergedBiCan = [...existingBiCan];
      const addedBiCan = [];
      const skippedBiCan = [];

      for (const newBiCan of newBiCanList) {
        // Check xem đã có bị can này chưa
        const isDuplicate = existingBiCan.some(existing => isDuplicateBiCan(existing, newBiCan));

        if (isDuplicate) {
          skippedBiCan.push(newBiCan);
        } else {
          // Merge thông tin thông minh: nếu existing có thông tin thiếu, bổ sung từ new
          const existingIndex = existingBiCan.findIndex(existing => 
            normalizeString(existing.ho_ten) === normalizeString(newBiCan.ho_ten)
          );

          if (existingIndex >= 0) {
            // Merge vào bị can hiện có
            const existing = mergedBiCan[existingIndex];
            Object.keys(newBiCan).forEach(key => {
              if (!existing[key] && newBiCan[key]) {
                existing[key] = newBiCan[key];
              } else if (Array.isArray(existing[key]) && Array.isArray(newBiCan[key])) {
                // Merge arrays (tội danh, điều khoản)
                const existingSet = new Set(existing[key].map(item => JSON.stringify(item)));
                newBiCan[key].forEach(item => {
                  if (!existingSet.has(JSON.stringify(item))) {
                    existing[key].push(item);
                  }
                });
              }
            });
          } else {
            // Thêm bị can mới
            mergedBiCan.push(newBiCan);
            addedBiCan.push(newBiCan);
          }
        }
      }

      // Cập nhật số lượng bị can
      const updatedCase = await Case.findByIdAndUpdate(
        caseId,
        {
          bi_can: mergedBiCan,
          so_bi_can_khoi_to: mergedBiCan.length,
          updated_by: req.userId || req.user?._id,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      )
        .populate('created_by', 'name email')
        .populate('updated_by', 'name email');

      res.status(200).json({
        success: true,
        data: updatedCase,
        merge_info: {
          added: addedBiCan.length,
          skipped: skippedBiCan.length,
          total_existing: existingBiCan.length,
          total_after_merge: mergedBiCan.length,
          skipped_details: skippedBiCan.map(bc => bc.ho_ten)
        },
        message: `Đã merge ${addedBiCan.length} bị can mới vào vụ án`
      });
    } catch (error) {
      console.error('Error merging bi can:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi merge bị can'
      });
    }
  }
};

export default CaseController;

