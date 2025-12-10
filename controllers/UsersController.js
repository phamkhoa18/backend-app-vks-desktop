import Users from '../models/Users.js';
import bcrypt from 'bcryptjs';

const UsersController = {
    getAllUsers: async (req, res) => {
        try {
            const users = await Users.find();
            res.status(200).json({ success: true, data: users, message: 'Users fetched successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    getUserById: async (req, res) => {
        try {
            const user = await Users.findById(req.params.id);
            res.status(200).json({ success: true, data: user, message: 'User fetched successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    createUser: async (req, res) => {
        try {
            // Mã hóa mật khẩu
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
            req.body.password = hashedPassword; 
            const user = await Users.create(req.body);
            res.status(201).json({ success: true, data: user, message: 'User created successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    updateUser: async (req, res) => {
        try {
            const user = await Users.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.status(200).json({ success: true, data: user, message: 'User updated successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    deleteUser: async (req, res) => {
        try {
            await Users.findByIdAndDelete(req.params.id);
            res.status(200).json({ success: true, message: 'User deleted successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            // Kiểm tra có đủ thông tin
            if (!email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Vui lòng nhập email và mật khẩu' 
                });
            }

            // Tìm user theo email
            const user = await Users.findOne({ email });
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Email hoặc mật khẩu không đúng' 
                });
            }

            // Kiểm tra mật khẩu
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Email hoặc mật khẩu không đúng' 
                });
            }

            // Login thành công
            res.status(200).json({ 
                success: true, 
                data: {
                    user
                },
                message: 'Đăng nhập thành công' 
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    register: async (req, res) => {
        try {
            const { email, password, name } = req.body;

            // Kiểm tra có đủ thông tin
            if (!email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Vui lòng nhập email và mật khẩu' 
                });
            }

            // Kiểm tra email đã tồn tại chưa
            const existingUser = await Users.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Email đã được sử dụng' 
                });
            }

            // Mã hóa mật khẩu
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Tạo user mới
            const userData = {
                email,
                password: hashedPassword,
                name: name || '',
                role: 'user'
            };

            const user = await Users.create(userData);

            // Trả về thông tin user (không trả về mật khẩu)
            res.status(201).json({ 
                success: true, 
                data: {
                    user
                },
                message: 'Đăng ký thành công' 
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

export default UsersController;