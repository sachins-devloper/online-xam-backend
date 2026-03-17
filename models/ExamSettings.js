const mongoose = require('mongoose');

const ExamSettingsSchema = new mongoose.Schema({
    duration: {
        type: String,
        required: true,
        default: '00:30:00'
    },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
});

module.exports = mongoose.model('ExamSettings', ExamSettingsSchema);
