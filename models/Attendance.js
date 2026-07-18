import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // format YYYY-MM-DD for easy daily lookup
    required: true
  },
  checkInTime: {
    type: Date,
    required: true
  },
  checkOutTime: {
    type: Date,
    default: null
  },
  workingHours: {
    type: Number, // in hours
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'leave'],
    default: 'present'
  },
  lateEntry: {
    type: Boolean,
    default: false
  },
  selfie: {
    type: String,
    default: null
  },
  location: {
    type: String,
    default: null
  }
});

// Set an index for unique employee daily attendance record
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
