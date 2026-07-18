import User from '../models/User.js';
import Task from '../models/Task.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';

// Helper to escape CSV values
const escapeCSV = (val) => {
  if (val === undefined || val === null) return '';
  let str = String(val);
  // Replace double quotes with two double quotes
  str = str.replace(/"/g, '""');
  // Wrap in quotes if it contains commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str}"`;
  }
  return str;
};

// Safe date/time formatting helpers
const formatDate = (dateVal) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
};

const formatTime = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
};

// @desc    Generate Attendance Report
// @route   GET /api/reports/attendance
// @access  Private (Main Admin, Admin)
export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    // Admin scope check
    if (req.user.role === 'admin') {
      const managedEmployees = await User.find({ adminId: req.user._id });
      const employeeIds = managedEmployees.map(emp => emp._id);
      
      if (employeeId) {
        if (!employeeIds.map(id => id.toString()).includes(employeeId)) {
          return res.status(403).json({ success: false, message: 'Not authorized to query this employee' });
        }
        query.employeeId = employeeId;
      } else {
        query.employeeId = { $in: employeeIds };
      }
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('employeeId', 'name email department')
      .sort({ date: -1 });

    const headers = ['Date', 'Employee Name', 'Employee Email', 'Department', 'Check In', 'Check Out', 'Working Hours', 'Status', 'Late Entry'];
    let csv = headers.join(',') + '\r\n';

    attendanceRecords.forEach(rec => {
      const row = [
        rec.date,
        rec.employeeId?.name || 'N/A',
        rec.employeeId?.email || 'N/A',
        rec.employeeId?.department || 'N/A',
        formatTime(rec.checkInTime),
        formatTime(rec.checkOutTime),
        rec.workingHours || 0,
        rec.status,
        rec.lateEntry ? 'YES' : 'NO'
      ];
      csv += row.map(escapeCSV).join(',') + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${Date.now()}.csv`);
    return res.status(200).send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate Tasks & Performance Report
// @route   GET /api/reports/tasks
// @access  Private (Main Admin, Admin)
export const getTasksReport = async (req, res) => {
  try {
    const { status, priority, employeeId } = req.query;

    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    if (req.user.role === 'admin') {
      const managedEmployees = await User.find({ adminId: req.user._id });
      const employeeIds = managedEmployees.map(emp => emp._id);
      
      if (employeeId) {
        if (!employeeIds.map(id => id.toString()).includes(employeeId)) {
          return res.status(403).json({ success: false, message: 'Not authorized to query this employee' });
        }
        query.assignedTo = employeeId;
      } else {
        query.assignedTo = { $in: employeeIds };
      }
    } else if (employeeId) {
      query.assignedTo = employeeId;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email department')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 });

    const headers = ['Task ID', 'Title', 'Description', 'Department', 'Priority', 'Status', 'Progress %', 'Deadline', 'Assigned To', 'Assigned By', 'Created At'];
    let csv = headers.join(',') + '\r\n';

    tasks.forEach(task => {
      const row = [
        task._id.toString(),
        task.title,
        task.description,
        task.department,
        task.priority,
        task.status,
        task.progress,
        formatDate(task.deadline),
        task.assignedTo?.name || 'N/A',
        task.assignedBy?.name || 'N/A',
        formatDate(task.createdAt)
      ];
      csv += row.map(escapeCSV).join(',') + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=tasks_report_${Date.now()}.csv`);
    return res.status(200).send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate Weekly/Monthly Performance Summary Report
// @route   GET /api/reports/performance
// @access  Private (Main Admin, Admin)
export const getPerformanceReport = async (req, res) => {
  try {
    // Collect all employees
    let query = { role: 'employee' };
    if (req.user.role === 'admin') {
      query.adminId = req.user._id;
    }

    const employees = await User.find(query);

    const headers = ['Employee Name', 'Email', 'Department', 'Total Tasks', 'Completed Tasks', 'Pending Tasks', 'Avg Progress %', 'Late Entries Count'];
    let csv = headers.join(',') + '\r\n';

    for (const emp of employees) {
      const totalTasks = await Task.countDocuments({ assignedTo: emp._id });
      const completedTasks = await Task.countDocuments({ assignedTo: emp._id, status: 'completed' });
      const pendingTasks = await Task.countDocuments({ assignedTo: emp._id, status: 'pending' });

      // Avg Progress
      const tasks = await Task.find({ assignedTo: emp._id });
      const avgProgress = tasks.length > 0
        ? parseFloat((tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length).toFixed(1))
        : 0;

      // Late check-ins
      const lateEntries = await Attendance.countDocuments({ employeeId: emp._id, lateEntry: true });

      const row = [
        emp.name,
        emp.email,
        emp.department,
        totalTasks,
        completedTasks,
        pendingTasks,
        avgProgress + '%',
        lateEntries
      ];
      csv += row.map(escapeCSV).join(',') + '\r\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=performance_report_${Date.now()}.csv`);
    return res.status(200).send('\ufeff' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
