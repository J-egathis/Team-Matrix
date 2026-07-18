import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import User from './models/User.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';

// Load env vars
dotenv.config();

// Connect to database
await connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if not exists
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Serve uploads static folder
app.use('/uploads', express.static(uploadsPath));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);

// Seed Database helper
const seedDatabase = async () => {
  try {
    const mainAdminExists = await User.findOne({ role: 'main_admin' });
    if (!mainAdminExists) {
      console.log('============================================');
      console.log('Seeding Database with Default Accounts...');

      // 1. Create Main Admin
      const mainAdmin = await User.create({
        name: 'sushek',
        email: 'mainadmin@workstatus.com',
        password: 'Password123',
        role: 'main_admin',
        department: 'Executive'
      });
      console.log('Seeded Main Admin: mainadmin@workstatus.com / Password123');

      // 2. Create Admin 1
      const admin1 = await User.create({
        name: 'vinoth',
        email: 'admin1@workstatus.com',
        password: 'Password123',
        role: 'admin',
        department: 'Development Dept'
      });
      console.log('Seeded Admin 1: admin1@workstatus.com / Password123');

      // 3. Create Admin 2
      const admin2 = await User.create({
        name: 'stafy',
        email: 'admin2@workstatus.com',
        password: 'Password123',
        role: 'admin',
        department: 'Creative Design'
      });
      console.log('Seeded Admin 2: admin2@workstatus.com / Password123');

      // 4. Create Employees managed by Admin 1
      const empsAdmin1 = [
        { name: 'sivanesan', email: 'employee1@workstatus.com', dept: 'Engineering' },
        { name: 'jegathis', email: 'employee2@workstatus.com', dept: 'Engineering' },
        { name: 'lokesh', email: 'employee3@workstatus.com', dept: 'QA & Testing' }
      ];

      for (const emp of empsAdmin1) {
        await User.create({
          name: emp.name,
          email: emp.email,
          password: 'Password123',
          role: 'employee',
          department: emp.dept,
          adminId: admin1._id
        });
        console.log(`Seeded Employee: ${emp.email} (Managed by Admin 1)`);
      }

      // 5. Create Employees managed by Admin 2
      const empsAdmin2 = [
        { name: 'jayavarni', email: 'employee4@workstatus.com', dept: 'UI/UX Design' },
        { name: 'karthik', email: 'employee5@workstatus.com', dept: 'Branding & Copy' },
        { name: 'monika', email: 'employee6@workstatus.com', dept: 'Product Marketing' }
      ];

      for (const emp of empsAdmin2) {
        await User.create({
          name: emp.name,
          email: emp.email,
          password: 'Password123',
          role: 'employee',
          department: emp.dept,
          adminId: admin2._id
        });
        console.log(`Seeded Employee: ${emp.email} (Managed by Admin 2)`);
      }
      console.log('Database Seeding Completed Successfully!');
      console.log('============================================');
    }
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
};

// Start seeding
await seedDatabase();

// Route all requests to public/index.html (Single Page App routing support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Port configuration
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
