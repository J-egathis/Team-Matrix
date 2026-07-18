import Expense from '../models/Expense.js';

// @desc    Add an expense
// @route   POST /api/expenses
// @access  Private
export const addExpense = async (req, res) => {
  try {
    const { title, amount, category, date, day, description } = req.body;

    if (!title || !amount || !category || !date || !day) {
      return res.status(400).json({ success: false, message: 'Please provide title, amount, category, date, and day' });
    }

    const expense = await Expense.create({
      userId: req.user._id,
      title,
      amount: Number(amount),
      category,
      date,
      day,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: expense
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get expenses list
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'employee') {
      query.userId = req.user._id;
    }

    const expenses = await Expense.find(query)
      .populate('userId', 'name email department role')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: expenses
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    // Employees can only delete their own expenses
    if (req.user.role === 'employee' && expense.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this expense' });
    }

    await expense.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Bulk delete expenses
// @route   POST /api/expenses/bulk-delete
// @access  Private
export const bulkDeleteExpenses = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of expense IDs' });
    }

    let deleteQuery = { _id: { $in: ids } };

    // Employees can only bulk delete their own expenses
    if (req.user.role === 'employee') {
      deleteQuery.userId = req.user._id;
    }

    await Expense.deleteMany(deleteQuery);

    res.status(200).json({
      success: true,
      message: 'Selected expenses deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
