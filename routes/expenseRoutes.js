import express from 'express';
import {
  addExpense,
  getExpenses,
  deleteExpense,
  bulkDeleteExpenses
} from '../controllers/expenseController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .post(protect, addExpense)
  .get(protect, getExpenses);

router.route('/bulk-delete')
  .post(protect, bulkDeleteExpenses);

router.route('/:id')
  .delete(protect, deleteExpense);

export default router;
