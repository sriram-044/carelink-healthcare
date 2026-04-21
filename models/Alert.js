const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['Critical', 'Risk', 'SOS'], required: true },
  message: { type: String, required: true },
  score: { type: Number },
  vitals: {
    heartRate: Number,
    spo2: Number,
    temperature: Number
  },
  reasons: [{ type: String }],
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', AlertSchema);
