const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VitalSigns = require('../models/VitalSigns');
const Alert = require('../models/Alert');
const Report = require('../models/Report');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// POST /api/admin/users — create any user
router.post('/users', auth, role('admin'), async (req, res) => {
  try {
    const { name, email, password, role: userRole, phone, age, gender, bloodGroup, specialization, department } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      name, email, password: hashedPassword, role: userRole,
      phone, age, gender, bloodGroup, specialization, department
    });
    await user.save();
    res.status(201).json({ message: 'User created successfully', user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/users — get all users (admin can filter; lab can read patients/doctors)
router.get('/users', auth, role('admin', 'lab'), async (req, res) => {
  try {
    const { role: filterRole } = req.query;
    const query = filterRole ? { role: filterRole } : {};
    const users = await User.find(query).select('-password').populate('assignedDoctor', 'name email');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/assign — assign doctor to patient
router.put('/assign', auth, role('admin'), async (req, res) => {
  try {
    const { patientId, doctorId } = req.body;
    await User.findByIdAndUpdate(patientId, { assignedDoctor: doctorId });
    await User.findByIdAndUpdate(doctorId, { $addToSet: { assignedPatients: patientId } });
    res.json({ message: 'Doctor assigned to patient successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', auth, role('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/users/:id — update user
router.put('/users/:id', auth, role('admin'), async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/analytics — system analytics
router.get('/analytics', auth, role('admin'), async (req, res) => {
  try {
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalDoctors = await User.countDocuments({ role: 'doctor' });
    const totalAlerts = await Alert.countDocuments();
    const unresolvedAlerts = await Alert.countDocuments({ resolved: false });
    const criticalAlerts = await Alert.countDocuments({ type: 'Critical', resolved: false });
    const totalReports = await Report.countDocuments();
    const flaggedReports = await Report.countDocuments({ status: 'Flagged' });

    const recentVitals = await VitalSigns.aggregate([
      { $group: { _id: '$aiStatus', count: { $sum: 1 } } }
    ]);

    res.json({
      totalPatients, totalDoctors,
      totalAlerts, unresolvedAlerts, criticalAlerts,
      totalReports, flaggedReports,
      vitalStatusBreakdown: recentVitals
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
