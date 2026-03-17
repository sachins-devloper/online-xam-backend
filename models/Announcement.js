const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
    exam_name: { type: String, required: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    testId: { type: String, unique: true }
});

module.exports = mongoose.model('announcement', AnnouncementSchema);
