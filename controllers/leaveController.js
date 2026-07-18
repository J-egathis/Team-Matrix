import Leave from '../models/Leave.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Attendance from '../models/Attendance.js';

// Helper to send notification
const createNotification = async (userId, type, title, message) => {
  await Notification.create({
    userId,
    type,
    title,
    message
  });
};

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private (Employee only)
export const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Please provide leaveType, startDate, endDate, and reason' });
    }

    // Get the employee's admin details
    const employee = await User.findById(req.user._id);
    if (!employee.adminId) {
      return res.status(400).json({ success: false, message: 'No managing Admin assigned to your profile. Please contact Main Admin' });
    }

    const leave = await Leave.create({
      employeeId: req.user._id,
      adminId: employee.adminId,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'pending'
    });

    // Notify the managing Admin
    await createNotification(
      employee.adminId,
      'leave_applied',
      'New Leave Request',
      `${req.user.name} applied for ${leaveType} from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
    );

    res.status(201).json({ success: true, message: 'Leave request submitted successfully', data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get leave history
// @route   GET /api/leaves
// @access  Private
export const getLeaveHistory = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'employee') {
      query.employeeId = req.user._id;
    } else if (req.user.role === 'admin') {
      query.adminId = req.user._id;
    } // main_admin can view all leaves

    const leaves = await Leave.find(query)
      .populate('employeeId', 'name email department profilePicture')
      .populate('adminId', 'name email department')
      .populate('actionBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: leaves.length, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve or Reject leave request
// @route   PUT /api/leaves/:id
// @access  Private (Main Admin, Admin)
export const approveRejectLeave = async (req, res) => {
  try {
    const { status, actionReason } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status (approved or rejected)' });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    // Verify Admin is authorized to act on this leave request
    if (req.user.role === 'admin' && leave.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this leave request' });
    }

    const oldStatus = leave.status;
    leave.status = status;
    leave.actionBy = req.user._id;
    leave.actionReason = actionReason || '';
    await leave.save();

    // Sync Attendance records
    if (status === 'approved') {
      let start = new Date(leave.startDate);
      let end = new Date(leave.endDate);
      let curr = new Date(start);
      while (curr <= end) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        await Attendance.findOneAndUpdate(
          { employeeId: leave.employeeId, date: dateStr },
          {
            employeeId: leave.employeeId,
            date: dateStr,
            checkInTime: leave.startDate,
            checkOutTime: leave.endDate,
            workingHours: 0,
            status: 'leave',
            lateEntry: false
          },
          { upsert: true, new: true }
        );
        curr.setDate(curr.getDate() + 1);
      }
    } else if (status === 'rejected' && oldStatus === 'approved') {
      // Remove sync if it was previously approved and is now rejected
      let start = new Date(leave.startDate);
      let end = new Date(leave.endDate);
      let curr = new Date(start);
      while (curr <= end) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        await Attendance.deleteOne({ employeeId: leave.employeeId, date: dateStr, status: 'leave' });
        curr.setDate(curr.getDate() + 1);
      }
    }

    // Notify employee of approval/rejection
    const notifType = status === 'approved' ? 'leave_approved' : 'leave_rejected';
    const notifTitle = status === 'approved' ? 'Leave Request Approved' : 'Leave Request Rejected';
    const notifMessage = status === 'approved'
      ? `Your leave request for ${leave.leaveType} has been approved by ${req.user.name}`
      : `Your leave request for ${leave.leaveType} has been rejected by ${req.user.name}. Reason: ${actionReason || 'None provided'}`;

    await createNotification(
      leave.employeeId,
      notifType,
      notifTitle,
      notifMessage
    );

    res.status(200).json({ success: true, message: `Leave request ${status} successfully`, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete leave request
// @route   DELETE /api/leaves/:id
// @access  Private (Main Admin, Admin)
export const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    // Verify user is authorized to delete this leave request
    if (req.user.role === 'employee' && leave.employeeId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this leave request' });
    }
    if (req.user.role === 'admin' && leave.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this leave request' });
    }

    // Clean up sync'ed Attendance records if it was approved
    if (leave.status === 'approved') {
      let start = new Date(leave.startDate);
      let end = new Date(leave.endDate);
      let curr = new Date(start);
      while (curr <= end) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        await Attendance.deleteOne({ employeeId: leave.employeeId, date: dateStr, status: 'leave' });
        curr.setDate(curr.getDate() + 1);
      }
    }

    await leave.deleteOne();

    res.status(200).json({ success: true, message: 'Leave request deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk delete leave requests
// @route   POST /api/leaves/bulk-delete
// @access  Private (Main Admin, Admin)
export const bulkDeleteLeaves = async (req, res) => {
  try {
    const { leaveIds } = req.body;
    if (!leaveIds || !Array.isArray(leaveIds) || leaveIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of leaveIds to delete' });
    }

    const leaves = await Leave.find({ _id: { $in: leaveIds } });
    const deletableIds = [];

    for (const leave of leaves) {
      if (req.user.role === 'employee' && leave.employeeId.toString() !== req.user._id.toString()) {
        // Not authorized to delete this leave request
      } else if (req.user.role === 'admin' && leave.adminId.toString() !== req.user._id.toString()) {
        // Not authorized to manage this leave request
      } else {
        deletableIds.push(leave._id);

        // Clean up sync'ed Attendance records if it was approved
        if (leave.status === 'approved') {
          let start = new Date(leave.startDate);
          let end = new Date(leave.endDate);
          let curr = new Date(start);
          while (curr <= end) {
            const year = curr.getFullYear();
            const month = String(curr.getMonth() + 1).padStart(2, '0');
            const day = String(curr.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            await Attendance.deleteOne({ employeeId: leave.employeeId, date: dateStr, status: 'leave' });
            curr.setDate(curr.getDate() + 1);
          }
        }
      }
    }

    if (deletableIds.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete any of the selected leave requests' });
    }

    await Leave.deleteMany({ _id: { $in: deletableIds } });

    res.status(200).json({ success: true, message: 'Selected leave requests deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
