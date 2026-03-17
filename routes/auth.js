const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const ExamResult = require('../models/ExamResult');
const Announcement = require('../models/Announcement');

// Register Student
router.post('/register', async (req, res) => {
    let { name, registerNumber, email, branch, department, password } = req.body;
    if (registerNumber) registerNumber = registerNumber.trim();
    if (email) email = email.trim();

    try {
        let user = await User.findOne({ $or: [{ registerNumber }, { email }] });
        if (user) {
            return res.status(400).json({ msg: 'Student already registered!' });
        }

        // Admin-Id is sent by frontend interceptor, linking the student to the sub-admin tenant
        const adminId = req.headers['admin-id'];

        if (!adminId) {
            return res.status(401).json({ msg: 'Cannot register student without an assigned admin session.' });
        }

        user = new User({ name, registerNumber, email, branch, department, password, adminId });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.json({ msg: 'Registration successful!' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Register Admin
router.post('/admin_register', async (req, res) => {
    const { name, email, username, password } = req.body;

    try {
        let admin = await Admin.findOne({ $or: [{ email }, { username }] });
        if (admin) {
            return res.status(400).json({ message: 'Email or Username already exists!' });
        }

        admin = new Admin({ name, email, username, password });

        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(password, salt);

        await admin.save();

        res.json({ msg: 'Admin registered successfully!' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Login Admin or Student
router.post('/login', async (req, res) => {
    const { emailOrUsername, password, requiredAdminUsername, testId, isAdminRoute } = req.body;

    try {
        // If a specific admin link is used, find that admin's ID first for validation (case-insensitive)
        let requiredAdminId = null;
        if (requiredAdminUsername) {
            const reqAdmin = await Admin.findOne({ username: { $regex: new RegExp("^" + requiredAdminUsername + "$", "i") } });
            if (reqAdmin) {
                requiredAdminId = reqAdmin._id.toString();
                console.log(`[SECURITY] Portal locked to: ${requiredAdminUsername} (ID: ${requiredAdminId})`);
            } else {
                console.log(`[SECURITY] Blocking invalid portal link: ${requiredAdminUsername}`);
                return res.status(404).json({ msg: 'Invalid portal link. This administrator does not exist.' });
            }
        } else {
            console.log(`[SECURITY] No required admin username, allowing all logins.`);
        }

        const identifier = emailOrUsername ? emailOrUsername.trim() : "";

        let admin = await Admin.findOne({ 
            username: { $regex: new RegExp("^" + identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") } 
        });
        if (admin) {
            // Block admins from logging in via student login page (root path without isAdminRoute)
            if (!isAdminRoute && !requiredAdminUsername) {
                return res.status(403).json({ msg: 'Admins cannot log in here. Please use the admin login page at /admin.' });
            }
            
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) return res.status(400).json({ msg: 'Invalid password for admin.' });

            // VALIDATION: If using a unique link, only allow this admin or a super-admin
            if (requiredAdminId && admin.role !== 'super-admin') {
                const currentAdminIdStr = admin._id.toString();
                if (currentAdminIdStr !== requiredAdminId) {
                    console.log(`[SECURITY] Admin Mismatch: Current(${currentAdminIdStr}) vs Required(${requiredAdminId})`);
                    return res.status(403).json({ msg: `Access Denied: This link belongs to ${requiredAdminUsername}. You cannot login here with different credentials.` });
                }
            }

            const payload = { admin: { id: admin.id, role: admin.role || 'sub-admin' } };
            jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: { id: admin.id, username: admin.username, name: admin.name, email: admin.email, role: admin.role || 'sub-admin', isAdmin: true }
                });
            });
            return;
        }

        // Check Student by email
        let user = await User.findOne({ 
            email: { $regex: new RegExp("^" + identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") } 
        });
        if (user) {
            // strictly prohibit students from accessing the admin route
            if (isAdminRoute) {
                return res.status(403).json({ msg: 'Students cannot log in here. Please use the student login page.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ msg: 'Invalid password for user.' });

            // VALIDATION: Ensure student belongs to this portal
            if (requiredAdminId) {
                const studentAdminIdStr = user.adminId ? user.adminId.toString() : null;
                if (studentAdminIdStr !== requiredAdminId) {
                    console.log(`[SECURITY] Student Mismatch: Student's Admin ID(${studentAdminIdStr}) vs Portal Admin ID(${requiredAdminId})`);
                    return res.status(403).json({ msg: `Access Denied: You are registered under a different administrator. Please use the login link provided to you.` });
                }
            }

            // Check if already attended test
            const hasAttended = await ExamResult.findOne({ register_number: user.registerNumber, adminId: user.adminId });
            const announcements = await Announcement.find({ adminId: user.adminId }).sort({ _id: -1 }).limit(1);

            if (hasAttended) {
                const Question = require('../models/Question');
                const questions = await Question.find({ adminId: user.adminId }).lean();
                
                let enhancedAnswers = hasAttended.answers.map(ans => {
                    let ansObj = ans.toObject ? ans.toObject() : ans;
                    if (!ansObj.options || ansObj.options.length === 0) {
                        const q = questions.find(q => q._id.toString() === ansObj.question_id);
                        if (q && q.options) {
                            ansObj.options = q.options;
                        }
                    }
                    return ansObj;
                });

                return res.status(403).json({ 
                    msg: 'already_attended', 
                    registerNumber: user.registerNumber,
                    score: hasAttended.total_score,
                    total: hasAttended.total_questions,
                    details: enhancedAnswers,
                    isMalpractice: hasAttended.isMalpractice
                });
            }

            if (announcements.length > 0) {
                // VALIDATION: Ensure student is logging into the CORRECT active session link
                if (testId && announcements[0].testId !== testId) {
                    return res.status(403).json({ msg: 'This exam link is expired or invalid for the current test session.' });
                }

                const now = new Date();
                const startTime = new Date(announcements[0].start_time);
                const endTime = new Date(announcements[0].end_time);

                if (now < startTime) {
                    return res.status(403).json({ msg: 'Access Denied: The exam has not started yet.' });
                }
                if (now > endTime) {
                    return res.status(403).json({ msg: 'Access Denied: You did not write the test within the test time.' });
                }
            } else {
                return res.status(403).json({ msg: 'Access Denied: No exam is available at this time.' });
            }

            const payload = { user: { id: user.id, registerNumber: user.registerNumber } };
            jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        registerNumber: user.registerNumber,
                        branch: user.branch,
                        department: user.department,
                        adminId: user.adminId, // Send tenant ID to frontend
                        isAdmin: false
                    }
                });
            });
            return;
        }

        return res.status(400).json({ msg: 'User not found with this email or username.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server crashed: ' + err.message });
    }
});

// @route   GET api/auth/exam/:testId
// @desc    Get active test details by unique session ID
// @access  Public
router.get('/exam/:testId', async (req, res) => {
    try {
        const test = await Announcement.findOne({ testId: req.params.testId });
        if (!test) return res.status(404).json({ msg: 'Invalid or Expired Test Link' });
        
        // Also fetch admin name to show on portal
        const admin = await Admin.findById(test.adminId);
        res.json({ ...test._doc, adminName: admin ? admin.name : 'Unknown Admin' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/auth/announcement/:username
// @desc    Get latest announcement for a specific admin to show on their unique login page
// @access  Public
router.get('/announcement/:username', async (req, res) => {
    try {
        const admin = await Admin.findOne({ username: req.params.username });
        if (!admin) return res.status(404).json({ msg: 'Admin not found' });

        const latestAnnouncement = await Announcement.findOne({ adminId: admin.id }).sort({ _id: -1 });
        res.json(latestAnnouncement || null);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/auth/upcoming-exams
// @desc    Get all upcoming/active exams for the general student login page
// @access  Public
router.get('/upcoming-exams', async (req, res) => {
    try {
        const now = new Date();
        // Find all announcements that haven't ended yet (active or upcoming)
        const announcements = await Announcement.find({
            end_time: { $gt: now }
        }).sort({ start_time: 1 }).lean();

        // Get admin names for each announcement
        const examsWithAdmin = await Promise.all(
            announcements.map(async (ann) => {
                const admin = await Admin.findById(ann.adminId).select('name username');
                return {
                    ...ann,
                    adminName: admin ? admin.name : 'Unknown Admin',
                    adminUsername: admin ? admin.username : 'unknown'
                };
            })
        );

        res.json(examsWithAdmin);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
