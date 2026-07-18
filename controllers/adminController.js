import User from '../models/User.js';
import Task from '../models/Task.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';

// @desc    Create a new admin
// @route   POST /api/admin/create-admin
// @access  Private (Main Admin only)
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const adminExists = await User.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      department: department || 'Management'
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new employee
// @route   POST /api/admin/create-employee
// @access  Private (Main Admin or Admin)
export const createEmployee = async (req, res) => {
  try {
    const { name, email, password, department, adminId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const employeeExists = await User.findOne({ email });
    if (employeeExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Determine managing Admin ID
    let assignedAdminId = null;
    if (req.user.role === 'admin') {
      assignedAdminId = req.user._id;
    } else if (req.user.role === 'main_admin') {
      if (!adminId) {
        return res.status(400).json({ success: false, message: 'Please select an Admin to manage this employee' });
      }
      assignedAdminId = adminId;
    }

    const employee = await User.create({
      name,
      email,
      password,
      role: 'employee',
      department: department || 'Engineering',
      adminId: assignedAdminId
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        adminId: employee.adminId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get admins list
// @route   GET /api/admin/admins
// @access  Private (Main Admin only)
export const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password');
    res.status(200).json({ success: true, count: admins.length, data: admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get employees list
// @route   GET /api/admin/employees
// @access  Private (Main Admin, Admin)
export const getEmployees = async (req, res) => {
  try {
    let query = { role: 'employee' };

    // If logged in user is an Admin, they can only view employees they manage
    if (req.user.role === 'admin') {
      query.adminId = req.user._id;
    }

    const employees = await User.find(query).populate('adminId', 'name email').select('-password');
    res.status(200).json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reassign employee to a different admin
// @route   PUT /api/admin/assign-employee
// @access  Private (Main Admin only)
export const assignEmployee = async (req, res) => {
  try {
    const { employeeId, adminId } = req.body;

    if (!employeeId || !adminId) {
      return res.status(400).json({ success: false, message: 'Please provide employeeId and adminId' });
    }

    const employee = await User.findOne({ _id: employeeId, role: 'employee' });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    employee.adminId = adminId;
    await employee.save();

    res.status(200).json({
      success: true,
      message: `Employee assigned to Admin ${admin.name} successfully`,
      data: employee
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard metrics (Aggregations)
// @route   GET /api/admin/dashboard-stats
// @access  Private (Main Admin, Admin)
export const getDashboardStats = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    if (req.user.role === 'main_admin') {
      // Main Admin Statistics
      const totalAdmins = await User.countDocuments({ role: 'admin' });
      const totalEmployees = await User.countDocuments({ role: 'employee' });
      
      // Calculate Projects (we'll count unique department fields or simply unique task counts)
      const tasksList = await Task.find({});
      const uniqueDepts = [...new Set(tasksList.map(t => t.department))];
      const totalProjects = uniqueDepts.length || 0;

      const activeTasks = await Task.countDocuments({ status: { $in: ['pending', 'in_progress', 'review', 'reopened'] } });
      const pendingTasks = await Task.countDocuments({ status: 'pending' });
      const completedTasks = await Task.countDocuments({ status: 'completed' });
      
      const attendanceToday = await Attendance.countDocuments({ date: todayStr, status: { $in: ['present', 'late'] } });
      const leaveRequests = await Leave.countDocuments({ status: 'pending' });

      // Recent activities (combine recent task modifications)
      const recentTasks = await Task.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('assignedTo', 'name email profilePicture')
        .populate('assignedBy', 'name');

      // Create dummy statistics data for the dashboard charts to ensure it has immediate historical visual impact
      const charts = {
        productivity: [65, 78, 72, 85, 89, 95, 92], // Last 7 days %
        performance: [82, 85, 88, 87, 91, 94], // last 6 months %
        taskCompletion: {
          pending: pendingTasks,
          inProgress: await Task.countDocuments({ status: 'in_progress' }),
          review: await Task.countDocuments({ status: 'review' }),
          completed: completedTasks,
          rejected: await Task.countDocuments({ status: 'rejected' })
        },
        attendanceRate: [94, 96, 92, 95, 98, 97, 95] // Last 7 days attendance %
      };

      return res.status(200).json({
        success: true,
        role: 'main_admin',
        stats: {
          totalAdmins,
          totalEmployees,
          totalProjects,
          activeTasks,
          pendingTasks,
          completedTasks,
          attendanceToday,
          leaveRequests
        },
        recentActivities: recentTasks,
        charts
      });

    } else if (req.user.role === 'admin') {
      // Admin Statistics (Only scope to Employees managed by this Admin)
      const employees = await User.find({ role: 'employee', adminId: req.user._id });
      const employeeIds = employees.map(emp => emp._id);

      const totalEmployees = employees.length;
      
      const tasksQuery = { assignedTo: { $in: employeeIds } };
      const totalTasks = await Task.countDocuments(tasksQuery);
      const pendingTasks = await Task.countDocuments({ ...tasksQuery, status: 'pending' });
      const completedTasks = await Task.countDocuments({ ...tasksQuery, status: 'completed' });
      const activeTasks = await Task.countDocuments({ ...tasksQuery, status: { $in: ['pending', 'in_progress', 'review', 'reopened'] } });

      const attendanceToday = await Attendance.countDocuments({
        employeeId: { $in: [...employeeIds, req.user._id] },
        date: todayStr,
        status: { $in: ['present', 'late'] }
      });

      const leaveRequests = await Leave.countDocuments({
        employeeId: { $in: employeeIds },
        status: 'pending'
      });

      // Fetch recent task activities for this admin's employees
      const recentTasks = await Task.find({ assignedTo: { $in: employeeIds } })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('assignedTo', 'name email profilePicture');

      const charts = {
        taskCompletion: {
          pending: pendingTasks,
          inProgress: await Task.countDocuments({ ...tasksQuery, status: 'in_progress' }),
          review: await Task.countDocuments({ ...tasksQuery, status: 'review' }),
          completed: completedTasks,
          rejected: await Task.countDocuments({ ...tasksQuery, status: 'rejected' })
        },
        employeeTaskCount: await Promise.all(employees.map(async (emp) => {
          const count = await Task.countDocuments({ assignedTo: emp._id, status: 'completed' });
          return { name: emp.name, completedTasks: count };
        }))
      };

      return res.status(200).json({
        success: true,
        role: 'admin',
        stats: {
          totalEmployees,
          totalTasks,
          pendingTasks,
          completedTasks,
          activeTasks,
          attendanceToday,
          leaveRequests
        },
        recentActivities: recentTasks,
        charts
      });
    }

    res.status(403).json({ success: false, message: 'Access denied' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete admin or employee account
// @route   DELETE /api/admin/users/:id
// @access  Private (Main Admin, Admin)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role-based authorization
    if (req.user.role === 'admin') {
      // Admins can only delete employees they manage
      if (user.role !== 'employee' || !user.adminId || user.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this user' });
      }
    } else if (req.user.role !== 'main_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Clean up related tasks, attendances, and leaves
    await Task.deleteMany({ assignedTo: user._id });
    await Attendance.deleteMany({ employeeId: user._id });
    await Leave.deleteMany({ employeeId: user._id });

    // Handle admin reassignment
    if (user.role === 'admin') {
      await User.updateMany({ adminId: user._id }, { $set: { adminId: null } });
    }

    await user.deleteOne();

    res.status(200).json({ success: true, message: 'User account and related data deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk delete admin or employee accounts
// @route   POST /api/admin/users/bulk-delete
// @access  Private (Main Admin, Admin)
export const bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of userIds to delete' });
    }

    const users = await User.find({ _id: { $in: userIds } });
    const deletableIds = [];

    for (const user of users) {
      if (req.user.role === 'admin') {
        // Admins can only delete employees they manage
        if (user.role === 'employee' && user.adminId && user.adminId.toString() === req.user._id.toString()) {
          deletableIds.push(user._id);
        }
      } else if (req.user.role === 'main_admin') {
        // Main Admin can delete any user except themselves
        if (user._id.toString() !== req.user._id.toString()) {
          deletableIds.push(user._id);
        }
      }
    }

    if (deletableIds.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete any of the selected users' });
    }

    // Clean up related tasks, attendances, leaves for deleted users
    await Task.deleteMany({ assignedTo: { $in: deletableIds } });
    await Attendance.deleteMany({ employeeId: { $in: deletableIds } });
    await Leave.deleteMany({ employeeId: { $in: deletableIds } });

    // Handle admin reassignment
    await User.updateMany({ adminId: { $in: deletableIds } }, { $set: { adminId: null } });

    // Delete users
    await User.deleteMany({ _id: { $in: deletableIds } });

    res.status(200).json({ success: true, message: 'Selected user accounts deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
