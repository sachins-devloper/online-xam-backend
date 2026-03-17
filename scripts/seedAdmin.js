const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('../models/Admin');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        // Check if admin already exists
        let existingAdmin = await Admin.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('Admin account already exists! Username: admin');
            process.exit(0);
        }

        // Create new admin
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const newAdmin = new Admin({
            username: 'admin',
            password: hashedPassword,
            name: 'Super Admin',
            email: 'admin@examportal.com'
        });

        await newAdmin.save();
        console.log('--------------------------------------------------');
        console.log('✅ Admin account seeded successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('--------------------------------------------------');
        
        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err.message);
        process.exit(1);
    }
};

seedAdmin();
