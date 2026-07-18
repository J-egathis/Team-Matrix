import express from 'express';
import {
  getAttendanceReport,
  getTasksReport,
  getPerformanceReport
} from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/attendance', protect, authorize('main_admin', 'admin'), getAttendanceReport);
router.get('/tasks', protect, authorize('main_admin', 'admin'), getTasksReport);
router.get('/performance', protect, authorize('main_admin', 'admin'), getPerformanceReport);

export default router;
