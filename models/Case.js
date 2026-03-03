import mongoose from 'mongoose';

const DieuKhoanDiemSchema = new mongoose.Schema({
  dieu: { type: Number, required: true },
  khoan: { type: Number, default: 0 },
  diem: { type: String, default: '' },
  bo_luat: { type: String, enum: ['BLHS', 'BLTTHS'], required: true },
  ten_toi_danh: { type: String }
}, { _id: false });

const VuAnSchema = new mongoose.Schema({
  ma_vu_an: { type: String, required: true, unique: true },
  ten_vu_an: { type: String, required: true },
  ma_cqdt: { type: String },
  so_cong_van_de_nghi: { type: String },
  ngay_cong_van: { type: Date },
  noi_dung_vu_viec: { type: String },
  trang_thai: {
    type: String,
    enum: ['khoi_to', 'dang_dieu_tra', 'da_truy_to', 'dang_xet_xu', 'da_ket_thuc'],
    default: 'khoi_to'
  },
  thoi_han_tam_giam: { type: String },
  so_quyet_dinh_khoi_to_vu_an: { type: String },
  ngay_khoi_to_vu_an: { type: Date },
  co_quan_khoi_to: { type: String },
  ngay_phan_cong_vu_an: { type: Date },
  dieu_khoan_diem: [DieuKhoanDiemSchema],
  ngay_xay_ra: { type: Date },
  toidanh: [{ type: String }],
  dia_diem_vu_an: { type: String }
}, { _id: false });

const ConRuotSchema = new mongoose.Schema({
  ho_ten: { type: String },
  nam_sinh: { type: String }
}, { _id: false });

const TienAnSchema = new mongoose.Schema({
  so_luong: { type: Number },
  ngay: { type: String },
  co_quan: { type: String },
  hinh_phat: { type: String },
  toi_danh: { type: [String], default: [] },
  thoi_gian_chap_hanh: { type: String }
}, { _id: false });

const BiCanSchema = new mongoose.Schema({
  ho_ten: { type: String, required: true },
  ten_goi_khac: { type: String },
  ngay_sinh: { type: Date },
  gioi_tinh: { type: String, default: 'Nam' },
  noi_sinh: { type: String },
  thuong_tru: { type: String },
  tam_tru: { type: String },
  nghe_nghiep: { type: String },
  trinh_do_hoc_van: { type: String },
  quoc_tich: { type: String, default: 'Việt Nam' },
  dan_toc: { type: String, default: 'Kinh' },
  ton_giao: { type: String },
  cccd: { type: String },
  ngay_cap_cccd: { type: Date },
  noi_cap_cccd: { type: String },
  tinh_trang_ngan_chan: {
    type: String,
    enum: ['tu_do', 'tam_giu', 'tam_giam', 'cam_di_khoi_noi_cu_tru'],
    default: 'tu_do'
  },
  thoi_diem_bat_giu: { type: Date },
  toi_danh_ca_nhan: [{ type: String }],
  dieu_khoan_diem: [DieuKhoanDiemSchema],
  ghi_chu: { type: String },
  chung_cu: { type: String },
  // Thông tin gia đình
  ho_ten_cha: { type: String },
  nam_sinh_cha: { type: String },
  cha_da_mat: { type: Boolean, default: false },
  ho_ten_me: { type: String },
  nam_sinh_me: { type: String },
  me_da_mat: { type: Boolean, default: false },
  vo_chong: {
    ho_ten: { type: String },
    nam_sinh: { type: String },
    da_mat: { type: Boolean, default: false },
    loai: { type: String, enum: ['vo', 'chong'], default: 'vo' }
  },
  con_ruot: [ConRuotSchema],
  tien_su: { type: String },
  tien_an: [TienAnSchema]
}, { _id: false });

const QDKhoiToBiCanSchema = new mongoose.Schema({
  so: { type: String },
  ngay: { type: Date },
  co_quan_ra_qd: { type: String }
}, { _id: false });

const DeNghiPheChuanKhoiToBiCanSchema = new mongoose.Schema({
  so: { type: String },
  ngay: { type: Date },
  co_quan_de_nghi: { type: String }
}, { _id: false });

const LenhTamGiamSchema = new mongoose.Schema({
  so: { type: String },
  ngay: { type: Date },
  thoi_han: { type: String },
  can_cu: { type: String }
}, { _id: false });

const BaoCaoSchema = new mongoose.Schema({
  kinh_gui: { type: String }
}, { _id: false });

const CaseSchema = new mongoose.Schema({
  vu_an: { type: VuAnSchema, required: true },
  bi_can: [BiCanSchema],
  giam_dinh: [{ type: mongoose.Schema.Types.Mixed }],
  vat_chung: [{ type: String }],
  qd_khoi_to_bi_can: { type: QDKhoiToBiCanSchema },
  de_nghi_phe_chuan_khoi_to_bi_can: { type: DeNghiPheChuanKhoiToBiCanSchema },
  lenh_tam_giam: { type: LenhTamGiamSchema },
  bao_cao: { type: BaoCaoSchema },
  lanh_dao_ky: { type: String },
  so_bi_can_khoi_to: { type: Number, default: 0 },
  so_bi_can_tam_giam: { type: Number, default: 0 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes để tối ưu query
CaseSchema.index({ 'vu_an.ma_vu_an': 1 });
CaseSchema.index({ 'vu_an.trang_thai': 1 });
CaseSchema.index({ createdAt: -1 });

const Case = mongoose.model('Case', CaseSchema);

export default Case;

