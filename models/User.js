import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    select: false
  },
  role: {
    type: String,
    enum: ['main_admin', 'admin', 'employee'],
    default: 'employee'
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Points to the Admin managing this employee
  },
  department: {
    type: String,
    default: 'General'
  },
  profilePicture: {
    type: String,
    default: ''
  },
  securitySettings: {
    twoFactor: {
      type: Boolean,
      default: false
    },
    sessionLimit: {
      type: Number,
      default: 60 // in minutes
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
