import express from 'express';
import UsersController from '../controllers/UsersController.js';

const router = express.Router();

router.get('/', UsersController.getAllUsers);
router.get('/:id', UsersController.getUserById);
router.post('/', UsersController.createUser);
router.put('/:id', UsersController.updateUser);
router.delete('/:id', UsersController.deleteUser);
router.post('/login', UsersController.login);
router.post('/register', UsersController.register);

export default router;