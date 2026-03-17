const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    role: { type: String, enum: ['super-admin', 'sub-admin'], default: 'sub-admin' },
});

module.exports = mongoose.model('admin', AdminSchema);
