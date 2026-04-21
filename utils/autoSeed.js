/**
 * autoSeed.js — Automatically seeds demo data for in-memory MongoDB
 * Called automatically when running with in-memory DB
 */

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VitalSigns = require('../models/VitalSigns');
const { Medication, DietPlan } = require('../models/Medication');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const { analyzeVitals } = require('./aiEngine');

const seed = async () => {
  try {
    const existing = await User.findOne({ email: 'patient@demo.com' });
    if (existing) return; // already seeded

    console.log('🌱 Seeding demo data...');
    const password = await bcrypt.hash('demo123', 10);

    // Create Admin
    await new User({
      name: 'Admin User', email: 'admin@demo.com', password,
      role: 'admin', phone: '+91 98765 43210', isActive: true
    }).save();

    // Create Doctor
    const doctor = await new User({
      name: 'Dr. Priya Sharma', email: 'doctor@demo.com', password,
      role: 'doctor', specialization: 'Cardiologist',
      department: 'Cardiology', phone: '+91 98765 11111', isActive: true
    }).save();

    // Create Lab
    await new User({
      name: 'Lab Technician', email: 'lab@demo.com', password,
      role: 'lab', department: 'Pathology', isActive: true
    }).save();

    // Create Patient
    const patient = await new User({
      name: 'Rajan Kumar', email: 'patient@demo.com', password,
      role: 'patient', age: 45, gender: 'male', bloodGroup: 'O+',
      phone: '+91 98765 22222', assignedDoctor: doctor._id, isActive: true
    }).save();

    // Update doctor's patient list
    await User.findByIdAndUpdate(doctor._id, {
      assignedPatients: [patient._id]
    });

    // Second patient
    const patient2 = await new User({
      name: 'Meena Pillai', email: 'patient2@demo.com', password,
      role: 'patient', age: 38, gender: 'female', bloodGroup: 'B+',
      phone: '+91 98765 33333', assignedDoctor: doctor._id, isActive: true
    }).save();

    // Third patient (critical case)
    const patient3 = await new User({
      name: 'Arun Mehta', email: 'patient3@demo.com', password,
      role: 'patient', age: 62, gender: 'male', bloodGroup: 'A-',
      phone: '+91 98765 44444', assignedDoctor: doctor._id, isActive: true
    }).save();

    await User.findByIdAndUpdate(doctor._id, {
      assignedPatients: [patient._id, patient2._id, patient3._id]
    });

    // Seed vitals — 7 days for Rajan (Risk trend)
    const now = new Date();
    const vitalsData = [
      { heartRate: 72, spo2: 99, temperature: 98.2, stepCount: 8500 },
      { heartRate: 78, spo2: 98, temperature: 98.6, stepCount: 7000 },
      { heartRate: 85, spo2: 97, temperature: 98.9, stepCount: 5000 },
      { heartRate: 90, spo2: 96, temperature: 99.2, stepCount: 3500 },
      { heartRate: 95, spo2: 95, temperature: 99.8, stepCount: 2000 },
      { heartRate: 102, spo2: 94, temperature: 100.4, stepCount: 1000 },
      { heartRate: 108, spo2: 93, temperature: 101.2, stepCount: 500 },
    ];

    for (let i = 0; i < vitalsData.length; i++) {
      const v = vitalsData[i];
      const ai = analyzeVitals(v.heartRate, v.spo2, v.temperature, v.stepCount);
      const date = new Date(now);
      date.setDate(date.getDate() - (vitalsData.length - 1 - i));
      await new VitalSigns({
        patientId: patient._id, ...v,
        aiScore: ai.score, aiStatus: ai.status,
        aiReasons: ai.reasons, aiRecommendation: ai.recommendation,
        recordedAt: date
      }).save();
    }

    // Vitals for Meena (stable)
    await new VitalSigns({
      patientId: patient2._id,
      heartRate: 74, spo2: 98, temperature: 98.4, stepCount: 9000,
      aiScore: 15, aiStatus: 'Normal',
      aiReasons: ['All vitals within normal range'],
      aiRecommendation: 'All vitals are within normal range. Continue your healthy routine.'
    }).save();

    // Vitals for Arun (critical)
    await new VitalSigns({
      patientId: patient3._id,
      heartRate: 128, spo2: 88, temperature: 103.5, stepCount: 200,
      aiScore: 90, aiStatus: 'Critical',
      aiReasons: ['Severe tachycardia: Heart rate 128 bpm (>120)', 'Severe hypoxia: SpO2 88% (<90%)', 'High fever: Temperature 103.5°F (>103°F)'],
      aiRecommendation: 'Immediate medical attention required.'
    }).save();

    // Alerts for Risk/Critical patients
    await new Alert({
      patientId: patient._id, doctorId: doctor._id,
      type: 'Risk',
      message: 'Risk vitals detected for Rajan Kumar. AI Score: 55/100',
      score: 55, vitals: { heartRate: 108, spo2: 93, temperature: 101.2 },
      reasons: ['Elevated heart rate: 108 bpm', 'Low SpO2: 93%', 'Mild fever: 101.2°F']
    }).save();

    await new Alert({
      patientId: patient3._id, doctorId: doctor._id,
      type: 'Critical',
      message: '🚨 CRITICAL vitals detected for Arun Mehta. AI Score: 90/100',
      score: 90, vitals: { heartRate: 128, spo2: 88, temperature: 103.5 },
      reasons: ['Severe tachycardia', 'Severe hypoxia', 'High fever']
    }).save();

    // Medication for Rajan
    await new Medication({
      patientId: patient._id, doctorId: doctor._id,
      name: 'Metoprolol', dosage: '50mg', frequency: 'Once daily',
      instructions: 'Take with or without food in the morning', isActive: true
    }).save();

    await new Medication({
      patientId: patient._id, doctorId: doctor._id,
      name: 'Aspirin', dosage: '75mg', frequency: 'Once daily',
      instructions: 'Take after meals', isActive: true
    }).save();

    await new Medication({
      patientId: patient._id, doctorId: doctor._id,
      name: 'Atorvastatin', dosage: '20mg', frequency: 'Once at night',
      instructions: 'Take before bed', isActive: true
    }).save();

    // Diet plan
    await new DietPlan({
      patientId: patient._id, doctorId: doctor._id,
      plan: `Breakfast: Oats with fruits and nuts, low-fat milk\nMid-morning: A handful of almonds + 1 fruit\nLunch: Brown rice / 2 chapati + dal + vegetables + salad\nEvening: Green tea + light snack (sprouts or nuts)\nDinner: 2 chapati + sabzi + curd (avoid heavy food after 8 PM)\n\nGeneral guidelines:\n- Reduce sodium intake (max 2g/day)\n- Avoid fried, processed, and sugary foods\n- Stay hydrated — minimum 8 glasses of water daily\n- Include omega-3 rich foods (fish, flaxseed)\n- Avoid alcohol and smoking`,
      calories: 1800,
      notes: 'Cardiac diet recommended. Reduce sodium. High fiber, low fat.'
    }).save();

    // Sample report (pending - no severity)
    await new Report({
      patientId: patient._id, doctorId: doctor._id,
      uploadedBy: 'lab', uploaderId: doctor._id,
      reportType: 'blood_test', labName: 'City Diagnostics',
      testDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      patientNote: 'Routine blood work as requested by Dr. Priya',
      status: 'Pending', fileName: 'blood_test.pdf'
    }).save();

    // Flagged report (reviewed with severity)
    await new Report({
      patientId: patient3._id, doctorId: doctor._id,
      uploadedBy: 'lab', uploaderId: doctor._id,
      reportType: 'ecg', labName: 'Apollo Diagnostics',
      testDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      patientNote: 'ECG ordered urgently due to chest pain',
      status: 'Flagged',
      doctorComment: 'Atrial fibrillation noted. Immediate cardiology consult required.',
      severity: 'Critical',
      reviewedAt: new Date(),
      fileName: 'ecg_report.pdf'
    }).save();

    // Normal reviewed report for Meena
    await new Report({
      patientId: patient2._id, doctorId: doctor._id,
      uploadedBy: 'patient', uploaderId: patient2._id,
      reportType: 'blood_test', labName: 'City Labs',
      testDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      patientNote: 'Annual blood test',
      status: 'Reviewed',
      doctorComment: 'All values within normal range. Continue current medication.',
      severity: 'Normal',
      reviewedAt: new Date(),
      fileName: 'blood_report_meena.pdf'
    }).save();

    console.log('✅ Demo data seeded successfully!');
    console.log('');
    console.log('  📧 patient@demo.com  / demo123  (Rajan Kumar)');
    console.log('  📧 doctor@demo.com   / demo123  (Dr. Priya Sharma)');
    console.log('  📧 admin@demo.com    / demo123  (Admin)');
    console.log('  📧 lab@demo.com      / demo123  (Lab Tech)');
    console.log('');

  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = { seed };
