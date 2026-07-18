import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Helper to push activity log
const logActivity = async (task, action, userId) => {
  task.activityHistory.push({
    action,
    user: userId,
    timestamp: new Date()
  });
  await task.save();
};

// Helper to send notification
const createNotification = async (userId, type, title, message) => {
  await Notification.create({
    userId,
    type,
    title,
    message
  });
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Main Admin, Admin)
export const createTask = async (req, res) => {
  try {
    const { title, description, priority, department, deadline, assignedTo } = req.body;

    if (!title || !description || !deadline || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Please provide title, description, deadline, and assignedTo' });
    }

    // Verify assignedTo user exists
    const assignee = await User.findById(assignedTo);
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Assigned user not found' });
    }

    if (req.user.role === 'main_admin') {
      // Super Admin can assign to both employees and admins
      if (assignee.role !== 'employee' && assignee.role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Super Admin can only assign tasks to Employees and Admins' });
      }
    } else if (req.user.role === 'admin') {
      // Regular Admins can only assign to employees
      if (assignee.role !== 'employee') {
        return res.status(400).json({ success: false, message: 'Admins can only assign tasks to Employees' });
      }

      // Ensure Admin has access to this Employee
      if (assignee.adminId && assignee.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to assign tasks to this employee' });
      }
    }

    let files = [];
    if (req.files) {
      files = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/${file.filename}`,
        type: file.mimetype
      }));
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 'medium',
      department: department || employee.department,
      deadline,
      assignedBy: req.user._id,
      assignedTo,
      attachments: files,
      status: 'pending',
      progress: 0
    });

    // Log Activity
    await logActivity(task, 'Task Created', req.user._id);

    // Send Notification to Employee
    await createNotification(
      assignedTo,
      'task_assigned',
      'New Task Assigned',
      `You have been assigned a new task: "${title}" by ${req.user.name}`
    );

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tasks with search, filters, pagination
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res) => {
  try {
    const { search, department, priority, status, assignedTo, assignedBy, deadline } = req.query;

    let query = {};

    // 1. Role-based scoping
    if (req.user.role === 'employee') {
      query.assignedTo = req.user._id;
    } else if (req.user.role === 'admin') {
      // Find all employees managed by this admin
      const employees = await User.find({ adminId: req.user._id });
      const employeeIds = employees.map(emp => emp._id);
      query.$or = [
        { assignedBy: req.user._id },
        { assignedTo: { $in: employeeIds } },
        { assignedTo: req.user._id }
      ];
    } // main_admin has no limits, query remains global

    // 2. Filters
    if (department) {
      query.department = department;
    }
    if (priority) {
      query.priority = priority;
    }
    if (status) {
      query.status = status;
    }
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    if (assignedBy) {
      query.assignedBy = assignedBy;
    }
    if (deadline) {
      // Find tasks due on or before this date
      query.deadline = { $lte: new Date(deadline) };
    }

    // 3. Global Search
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email profilePicture department')
      .populate('assignedBy', 'name email profilePicture department')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single task details
// @route   GET /api/tasks/:id
// @access  Private
export const getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email profilePicture role department')
      .populate('assignedBy', 'name email profilePicture role department')
      .populate('comments.user', 'name email profilePicture role')
      .populate('activityHistory.user', 'name email role');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Scope check: Admin/Employee checks
    if (req.user.role === 'employee' && task.assignedTo._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to this task' });
    }

    if (req.user.role === 'admin') {
      const isCreator = task.assignedBy._id.toString() === req.user._id.toString();
      const isAssignee = task.assignedTo._id.toString() === req.user._id.toString();
      
      // Fetch assignee adminId if populated assignee doesn't have it (or compare via query check)
      const assigneeUser = await User.findById(task.assignedTo._id);
      const isAssignedAdmin = assigneeUser.adminId && assigneeUser.adminId.toString() === req.user._id.toString();

      if (!isCreator && !isAssignee && !isAssignedAdmin) {
        return res.status(403).json({ success: false, message: 'Access denied to tasks of employees outside your scope' });
      }
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res) => {
  try {
    const { title, description, priority, deadline, status, progress, assignedTo } = req.body;

    let task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Capture changes for activity logging
    const changes = [];

    // Role-based editing restriction
    if (req.user.role === 'employee') {
      // Employee can only update status, progress, and upload attachments
      if (status && status !== task.status) {
        changes.push(`Status changed from ${task.status} to ${status}`);
        task.status = status;
      }
      if (progress !== undefined && Number(progress) !== task.progress) {
        changes.push(`Progress changed from ${task.progress}% to ${progress}%`);
        task.progress = Number(progress);
      }
    } else {
      // Main Admin / Admin has full edits
      if (title && title !== task.title) {
        changes.push(`Title updated to "${title}"`);
        task.title = title;
      }
      if (description && description !== task.description) {
        changes.push('Description updated');
        task.description = description;
      }
      if (priority && priority !== task.priority) {
        changes.push(`Priority changed from ${task.priority} to ${priority}`);
        task.priority = priority;
      }
      if (deadline && new Date(deadline).getTime() !== new Date(task.deadline).getTime()) {
        changes.push(`Deadline updated to ${new Date(deadline).toLocaleDateString()}`);
        task.deadline = deadline;
      }
      if (status && status !== task.status) {
        changes.push(`Status changed from ${task.status} to ${status}`);
        task.status = status;
      }
      if (progress !== undefined && Number(progress) !== task.progress) {
        changes.push(`Progress updated from ${task.progress}% to ${progress}%`);
        task.progress = Number(progress);
      }
      if (assignedTo && assignedTo !== task.assignedTo.toString()) {
        const newEmp = await User.findById(assignedTo);
        changes.push(`Reassigned task to ${newEmp ? newEmp.name : 'another employee'}`);
        task.assignedTo = assignedTo;
      }
    }

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      const newFiles = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/${file.filename}`,
        type: file.mimetype
      }));
      task.attachments.push(...newFiles);
      changes.push(`Uploaded ${newFiles.length} file(s)`);
    }

    if (changes.length > 0) {
      // Log each change as a log event
      for (const change of changes) {
        task.activityHistory.push({
          action: change,
          user: req.user._id,
          timestamp: new Date()
        });
      }

      await task.save();

      // Trigger notifications
      const recipientId = (req.user.role === 'employee') ? task.assignedBy : task.assignedTo;
      const type = (task.status === 'completed') ? 'task_completed' : 'task_updated';
      const notificationTitle = (task.status === 'completed') ? 'Task Completed' : 'Task Updated';
      
      await createNotification(
        recipientId,
        type,
        notificationTitle,
        `Task "${task.title}" has been updated by ${req.user.name}: ${changes.join(', ')}`
      );
    }

    res.status(200).json({ success: true, message: 'Task updated successfully', data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private (Main Admin, Admin)
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Admin scope check
    if (req.user.role === 'admin' && task.assignedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete tasks created by other admins' });
    }

    await Task.deleteOne({ _id: req.params.id });

    // Notify employee of deletion
    await createNotification(
      task.assignedTo,
      'general',
      'Task Deleted',
      `The task "${task.title}" has been deleted by Admin`
    );

    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk delete tasks
// @route   POST /api/tasks/bulk-delete
// @access  Private (Main Admin, Admin)
export const bulkDeleteTasks = async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of taskIds to delete' });
    }

    const tasks = await Task.find({ _id: { $in: taskIds } });
    const deletableIds = [];
    const notAuthorizedIds = [];

    for (const task of tasks) {
      if (req.user.role === 'admin' && task.assignedBy.toString() !== req.user._id.toString()) {
        notAuthorizedIds.push(task._id);
      } else {
        deletableIds.push(task._id);
      }
    }

    if (deletableIds.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete any of the selected tasks' });
    }

    await Task.deleteMany({ _id: { $in: deletableIds } });

    for (const task of tasks) {
      if (deletableIds.includes(task._id)) {
        await createNotification(
          task.assignedTo,
          'general',
          'Task Deleted',
          `The task "${task.title}" has been deleted by Admin`
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletableIds.length} tasks.${notAuthorizedIds.length > 0 ? ` ${notAuthorizedIds.length} tasks were not deleted due to authorization limits.` : ''}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add comment to a task
// @route   POST /api/tasks/:id/comments
// @access  Private
export const addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Push comment
    task.comments.push({
      user: req.user._id,
      comment,
      timestamp: new Date()
    });

    // Log Activity
    task.activityHistory.push({
      action: `Added a comment: "${comment.substring(0, 30)}${comment.length > 30 ? '...' : ''}"`,
      user: req.user._id,
      timestamp: new Date()
    });

    await task.save();

    // Notify other party
    const recipientId = (req.user.role === 'employee') ? task.assignedBy : task.assignedTo;
    await createNotification(
      recipientId,
      'task_updated',
      'New Comment on Task',
      `${req.user.name} commented on "${task.title}": "${comment.substring(0, 40)}..."`
    );

    // Retrieve full comments populated
    const updatedTask = await Task.findById(req.params.id).populate('comments.user', 'name email profilePicture role');

    res.status(200).json({ success: true, data: updatedTask.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
