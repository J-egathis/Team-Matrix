import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const activitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a task title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a task description']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  department: {
    type: String,
    default: 'General'
  },
  deadline: {
    type: Date,
    required: [true, 'Please add a deadline']
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [
    {
      name: String,
      url: String,
      type: {
        type: String
      }
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'review', 'completed', 'rejected', 'reopened'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  comments: [commentSchema],
  activityHistory: [activitySchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Task = mongoose.model('Task', taskSchema);
export default Task;
