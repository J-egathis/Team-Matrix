import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'workstatus_jwt_secret_token_2026_premium_minimal', {
    expiresIn: '30d'
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Send user (without password)
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminId: user.adminId,
      department: user.department,
      profilePicture: user.profilePicture,
      securitySettings: user.securitySettings,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      token,
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, email, department } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(444).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (department) user.department = department;

    if (email && email !== user.email) {
      // Check if email already in use
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      user.email = email;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update security settings
// @route   PUT /api/auth/security
// @access  Private
export const updateSecurity = async (req, res) => {
  try {
    const { twoFactor, sessionLimit } = req.body;
    
    const user = await User.findById(req.user.id);

    if (user.securitySettings) {
      if (typeof twoFactor !== 'undefined') user.securitySettings.twoFactor = twoFactor;
      if (typeof sessionLimit !== 'undefined') user.securitySettings.sessionLimit = sessionLimit;
    } else {
      user.securitySettings = {
        twoFactor: twoFactor || false,
        sessionLimit: sessionLimit || 60
      };
    }

    await user.save();
    res.status(200).json({ success: true, message: 'Security settings updated', data: user.securitySettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload profile picture
// @route   POST /api/auth/avatar
// @access  Private
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const user = await User.findById(req.user.id);
    user.profilePicture = `/uploads/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      url: user.profilePicture
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
