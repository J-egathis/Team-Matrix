import express from 'express';
import {
  createAdmin,
  createEmployee,
  getAdmins,
  getEmployees,
  assignEmployee,
  getDashboardStats,
  deleteUser,
  bulkDeleteUsers
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/create-admin', protect, authorize('main_admin'), createAdmin);
router.post('/create-employee', protect, authorize('main_admin', 'admin'), createEmployee);
router.get('/admins', protect, authorize('main_admin'), getAdmins);
router.get('/employees', protect, authorize('main_admin', 'admin'), getEmployees);
router.put('/assign-employee', protect, authorize('main_admin'), assignEmployee);
router.get('/dashboard-stats', protect, authorize('main_admin', 'admin'), getDashboardStats);

router.delete('/users/:id', protect, authorize('main_admin', 'admin'), deleteUser);
router.post('/users/bulk-delete', protect, authorize('main_admin', 'admin'), bulkDeleteUsers);

export default router;
