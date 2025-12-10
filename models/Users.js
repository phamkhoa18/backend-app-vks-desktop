import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  thongtin_ksv: {
    tenksv: {type: String , default: ''},
    chucdanh: { type: String , default: ''},
    captren: { type: String , default: ''},
    donvi: { type: String , default: ''},
    donvibaocao: { type: String , default: ''},
    phovientruong: [{ type: String }],
    vientruong: { type: String , default: ''},
    ky_hieu_quyet_dinh: { type: String , default: ''},
    ky_hieu_yeu_cau: { type: String , default: ''},
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

export default User;