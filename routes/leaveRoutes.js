import express from 'express';
import {
  applyLeave,
  getLeaveHistory,
  approveRejectLeave,
  deleteLeave,
  bulkDeleteLeaves
} from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .post(protect, authorize('employee'), applyLeave)
  .get(protect, getLeaveHistory);

router.route('/bulk-delete')
  .post(protect, authorize('main_admin', 'admin', 'employee'), bulkDeleteLeaves);

router.route('/:id')
  .put(protect, authorize('main_admin', 'admin'), approveRejectLeave)
  .delete(protect, authorize('main_admin', 'admin', 'employee'), deleteLeave);

export default router;
