const mongoose = require('mongoose');

const ExamResultSchema = new mongoose.Schema({
    student_name: { type: String, required: true },
    register_number: { type: String, required: true, unique: true },
    total_score: { type: Number, required: true },
    total_questions: { type: Number, required: true },
    answers: [{
        question_id: String,
        question_text: String,
        options: [String],
        selected_option: String,
        correct_option: String,
        is_correct: Boolean
    }],
    submitted_at: { type: Date, default: Date.now },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
});

module.exports = mongoose.model('examResult', ExamResultSchema);
