import express from 'express';
import {
  login,
  getMe,
  updateProfile,
  updatePassword,
  updateSecurity,
  uploadAvatar
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);
router.put('/security', protect, updateSecurity);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

export default router;
