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
        let existingAdmin = await Admin.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
        if (existingAdmin) {
            console.log(`Admin account already exists! Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
            process.exit(0);
        }

        // Create new admin
        const salt = await bcrypt.genSalt(10);
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAdmin = new Admin({
            username: process.env.ADMIN_USERNAME || 'admin',
            password: hashedPassword,
            name: 'Super Admin',
            email: process.env.ADMIN_EMAIL || 'admin@examportal.com',
            role: 'super-admin'
        });

        await newAdmin.save();
        console.log('--------------------------------------------------');
        console.log('✅ Admin account seeded successfully!');
        console.log(`Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
        console.log(`Password: ${password}`);
        console.log('--------------------------------------------------');
        
        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err.message);
        process.exit(1);
    }
};

seedAdmin();
