import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllRead
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getNotifications);

router.route('/mark-all-read')
  .put(protect, markAllRead);

router.route('/:id')
  .put(protect, markAsRead);

export default router;
