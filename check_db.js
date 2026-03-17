const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const User = require('./models/User');

dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const adminCount = await Admin.countDocuments();
        const userCount = await User.countDocuments();
        console.log(`Admins: ${adminCount}`);
        console.log(`Users: ${userCount}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();
