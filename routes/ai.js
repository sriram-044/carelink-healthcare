const express = require('express');
const router = express.Router();
const VitalSigns = require('../models/VitalSigns');
const auth = require('../middleware/auth');
const { analyzeVitals, analyzeTrend } = require('../utils/aiEngine');

// GET /api/ai/analyze/:patientId — analyze latest vitals
router.get('/analyze/:patientId', auth, async (req, res) => {
  try {
    const latest = await VitalSigns.findOne({ patientId: req.params.patientId })
      .sort({ recordedAt: -1 });

    if (!latest) {
      return res.status(404).json({ message: 'No vitals found for this patient' });
    }

    const ai = analyzeVitals(latest.heartRate, latest.spo2, latest.temperature, latest.stepCount);
    res.json({
      patientId: req.params.patientId,
      vitals: {
        heartRate: latest.heartRate,
        spo2: latest.spo2,
        temperature: latest.temperature
      },
      ai,
      recordedAt: latest.recordedAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/ai/history/:patientId — 7-day score history
router.get('/history/:patientId', auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await VitalSigns.find({
      patientId: req.params.patientId,
      recordedAt: { $gte: sevenDaysAgo }
    }).sort({ recordedAt: 1 });

    const scoreHistory = history.map(v => v.aiScore);
    const trend = analyzeTrend(scoreHistory);

    res.json({
      history: history.map(v => ({
        date: v.recordedAt,
        score: v.aiScore,
        status: v.aiStatus,
        heartRate: v.heartRate,
        spo2: v.spo2,
        temperature: v.temperature
      })),
      trend,
      scoreHistory
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
