import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Office Supplies', 'Travel', 'Meals & Entertainment', 'Equipment', 'Software/SaaS', 'Utilities', 'Other']
  },
  date: {
    type: Date,
    required: true
  },
  day: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
