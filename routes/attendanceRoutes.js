import express from 'express';
import {
  checkIn,
  checkOut,
  getTodayStatus,
  getAttendanceHistory
} from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/check-in', protect, authorize('employee', 'admin', 'main_admin'), checkIn);
router.post('/check-out', protect, authorize('employee', 'admin', 'main_admin'), checkOut);
router.get('/today', protect, authorize('employee', 'admin', 'main_admin'), getTodayStatus);
router.get('/history', protect, getAttendanceHistory);

export default router;
