import express from 'express';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  bulkDeleteTasks,
  addComment
} from '../controllers/taskController.js';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.route('/')
  .post(protect, authorize('main_admin', 'admin'), upload.array('attachments', 5), createTask)
  .get(protect, getTasks);

router.route('/bulk-delete')
  .post(protect, authorize('main_admin', 'admin'), bulkDeleteTasks);

router.route('/:id')
  .get(protect, getTask)
  .put(protect, upload.array('attachments', 5), updateTask)
  .delete(protect, authorize('main_admin', 'admin'), deleteTask);

router.route('/:id/comments')
  .post(protect, addComment);

export default router;
