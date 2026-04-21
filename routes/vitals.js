const express = require('express');
const router = express.Router();
const VitalSigns = require('../models/VitalSigns');
const Alert = require('../models/Alert');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { analyzeVitals } = require('../utils/aiEngine');

// POST /api/vitals — submit new vitals (patient)
router.post('/', auth, async (req, res) => {
  try {
    const { heartRate, spo2, temperature, systolicBP, diastolicBP, stepCount, weight, glucoseLevel } = req.body;
    const patientId = req.user.role === 'patient' ? req.user._id : req.body.patientId;

    // Run AI engine
    const ai = analyzeVitals(heartRate, spo2, temperature, stepCount || 0);

    const vitals = new VitalSigns({
      patientId,
      heartRate, spo2, temperature,
      systolicBP, diastolicBP,
      stepCount, weight, glucoseLevel,
      aiScore: ai.score,
      aiStatus: ai.status,
      aiReasons: ai.reasons,
      aiRecommendation: ai.recommendation
    });
    await vitals.save();

    // Auto-alert if Risk or Critical
    if (ai.status === 'Risk' || ai.status === 'Critical') {
      const patient = await User.findById(patientId);
      const alert = new Alert({
        patientId,
        doctorId: patient?.assignedDoctor,
        type: ai.status,
        message: `${ai.status} vitals detected for patient. AI Score: ${ai.score}/100`,
        score: ai.score,
        vitals: { heartRate, spo2, temperature },
        reasons: ai.reasons
      });
      await alert.save();
    }

    res.status(201).json({
      message: 'Vitals recorded successfully',
      vitals,
      ai
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/vitals/:patientId/latest — latest vitals  (MUST be before /:patientId)
router.get('/:patientId/latest', auth, async (req, res) => {
  try {
    const vitals = await VitalSigns.findOne({ patientId: req.params.patientId })
      .sort({ recordedAt: -1 });
    res.json(vitals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/vitals/:patientId — vitals history
router.get('/:patientId', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const vitals = await VitalSigns.find({ patientId: req.params.patientId })
      .sort({ recordedAt: -1 })
      .limit(limit);
    res.json(vitals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

