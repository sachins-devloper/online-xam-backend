const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Admin = require('./models/Admin');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const admins = await Admin.find();
  console.log('ADMINS:', admins);
  process.exit();
}
test();
