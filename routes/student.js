const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const ExamResult = require('../models/ExamResult');
const ExamSettings = require('../models/ExamSettings');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Get questions for the exam
router.get('/questions', async (req, res) => {
    try {
        const questions = await Question.find({ adminId: req.headers['admin-id'] });
        res.json(questions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Exam Timer
router.get('/timer', async (req, res) => {
    try {
        const settings = await ExamSettings.findOne({ adminId: req.headers['admin-id'] });
        if (settings) {
            res.json({ duration: settings.duration });
        } else {
            res.json({ duration: '00:30:00' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Submit Exam
router.post('/submit', async (req, res) => {
    const { registerNumber, answers } = req.body;
    try {
        const student = await User.findOne({ registerNumber, adminId: req.headers['admin-id'] });
        if (!student) return res.status(404).json({ msg: 'Student not found' });

        const questions = await Question.find({ adminId: req.headers['admin-id'] }).sort({ _id: 1 });
        let score = 0;
        let total = questions.length;

        let selected_answers = [];
        let all_question_ids = [];
        let detailed_answers = [];

        questions.forEach(q => {
            const student_answer_val = answers[q._id];
            const student_answer = student_answer_val || 'NULL';
            const is_correct = (student_answer.toString() === q.correct_answer.toString());
            
            if (is_correct) score++;

            selected_answers.push(student_answer);
            all_question_ids.push(q._id.toString());
            
            let selected_text = "Not Answered";
            if (student_answer_val && !isNaN(student_answer_val) && q.options) {
                selected_text = q.options[parseInt(student_answer_val) - 1] || student_answer_val;
            }
            
            let correct_text = "N/A";
            if (q.correct_answer && !isNaN(q.correct_answer) && q.options) {
                correct_text = q.options[parseInt(q.correct_answer) - 1] || q.correct_answer;
            }

            detailed_answers.push({
                question_id: q._id.toString(),
                question_text: q.question_text,
                options: q.options || [],
                selected_option: selected_text,
                correct_option: correct_text,
                is_correct: is_correct
            });
        });

        // Insert or Update ExamResult
        await ExamResult.findOneAndUpdate(
            { register_number: registerNumber, adminId: req.headers['admin-id'] },
            {
                student_name: student.name,
                total_score: score,
                total_questions: total,
                answers: detailed_answers,
                submitted_at: new Date(),
                adminId: req.headers['admin-id']
            },
            { upsert: true, new: true, runValidators: true }
        );

// CSV generation is now handled dynamically in the admin dashboard route

        res.json({ score, total, detailed_answers });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Exam Result
router.get('/result/:registerNumber', async (req, res) => {
    try {
        const query = { register_number: req.params.registerNumber };
        // Only add adminId to query if header is present
        if (req.headers['admin-id']) {
            query.adminId = req.headers['admin-id'];
        }
        const result = await ExamResult.findOne(query);
        if (result) {
            const Question = require('../models/Question');
            const questions = await Question.find({ adminId: result.adminId }).lean();
            
            let enhancedAnswers = result.answers.map(ans => {
                let ansObj = ans.toObject ? ans.toObject() : ans;
                if (!ansObj.options || ansObj.options.length === 0) {
                    const q = questions.find(q => q._id.toString() === ansObj.question_id);
                    if (q && q.options) {
                        ansObj.options = q.options;
                    }
                }
                return ansObj;
            });
            
            res.json({ score: result.total_score, total: result.total_questions, details: enhancedAnswers });
        } else {
            res.status(404).json({ msg: 'Result not found' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
