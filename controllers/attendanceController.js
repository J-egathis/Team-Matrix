import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

// @desc    Check In
// @route   POST /api/attendance/check-in
// @access  Private (Employee only)
export const checkIn = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Check if already checked in today
    const existingRecord = await Attendance.findOne({
      employeeId: req.user._id,
      date: todayStr
    });

    if (existingRecord) {
      return res.status(400).json({ success: false, message: 'You have already checked in today' });
    }

    // Determine late entry (Threshold: 9:15 AM)
    let isLate = false;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours > 9 || (hours === 9 && minutes > 15)) {
      isLate = true;
    }

    const status = isLate ? 'late' : 'present';

    const { selfie, location } = req.body;

    const attendance = await Attendance.create({
      employeeId: req.user._id,
      date: todayStr,
      checkInTime: now,
      status,
      lateEntry: isLate,
      selfie,
      location
    });

    res.status(201).json({ success: true, message: 'Checked in successfully', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check Out
// @route   POST /api/attendance/check-out
// @access  Private (Employee only)
export const checkOut = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    const attendance = await Attendance.findOne({
      employeeId: req.user._id,
      date: todayStr
    });

    if (!attendance) {
      return res.status(400).json({ success: false, message: 'You have not checked in today yet' });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ success: false, message: 'You have already checked out today' });
    }

    // Calculate working hours
    const checkIn = new Date(attendance.checkInTime);
    const diffMs = now - checkIn;
    const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)); // round to 2 decimals

    attendance.checkOutTime = now;
    attendance.workingHours = workingHours;
    await attendance.save();

    res.status(200).json({ success: true, message: 'Checked out successfully', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get employee's attendance status today
// @route   GET /api/attendance/today
// @access  Private (Employee only)
export const getTodayStatus = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      employeeId: req.user._id,
      date: todayStr
    });

    res.status(200).json({
      success: true,
      hasCheckedIn: !!attendance,
      hasCheckedOut: attendance ? !!attendance.checkOutTime : false,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance history (calendar data)
// @route   GET /api/attendance/history
// @access  Private
export const getAttendanceHistory = async (req, res) => {
  try {
    const { employeeId, year, month } = req.query;
    let query = {};

    if (employeeId) {
      const targetUser = await User.findById(employeeId);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      // If target user is an Admin or Super Admin, only Super Admin can view their logs
      if ((targetUser.role === 'admin' || targetUser.role === 'main_admin') && req.user.role !== 'main_admin') {
        return res.status(403).json({ success: false, message: 'Access denied to admin attendance records' });
      }
      // If standard Admin is querying an employee, verify the employee is managed by this Admin
      if (req.user.role === 'admin' && targetUser.role === 'employee') {
        if (!targetUser.adminId || targetUser.adminId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied to this employee attendance record' });
        }
      }
      query.employeeId = employeeId;
    } else {
      // No specific employeeId provided: return list according to role
      if (req.user.role === 'main_admin') {
        // Super Admin gets all attendance (both employees and admins)
        // No employeeId filter
      } else if (req.user.role === 'admin') {
        // Admin gets ONLY their managed employees (excluding themselves)
        const managedEmployees = await User.find({ adminId: req.user._id, role: 'employee' });
        const employeeIds = managedEmployees.map(emp => emp._id);
        query.employeeId = { $in: employeeIds };
      } else {
        // Employee gets only their own
        query.employeeId = req.user._id;
      }
    }

    // Filter by year and month if provided
    if (year && month) {
      const padMonth = String(month).padStart(2, '0');
      query.date = { $regex: `^${year}-${padMonth}-` };
    }

    const history = await Attendance.find(query)
      .populate('employeeId', 'name email role department profilePicture')
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
