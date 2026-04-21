/**
 * CareLink Seed Script
 * Creates demo users: patient, doctor, admin, lab
 * Run: node utils/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing demo users
  await User.deleteMany({ email: { $in: ['patient@demo.com','doctor@demo.com','admin@demo.com','lab@demo.com'] } });

  const password = await bcrypt.hash('demo123', 12);

  const admin = new User({
    name: 'Admin User', email: 'admin@demo.com', password, role: 'admin',
    phone: '+91 98765 43210', isActive: true
  });

  const doctor = new User({
    name: 'Dr. Priya Sharma', email: 'doctor@demo.com', password, role: 'doctor',
    specialization: 'Cardiologist', department: 'Cardiology',
    phone: '+91 98765 11111', isActive: true
  });

  const patient = new User({
    name: 'Rajan Kumar', email: 'patient@demo.com', password, role: 'patient',
    age: 45, gender: 'male', bloodGroup: 'O+',
    phone: '+91 98765 22222', isActive: true
  });

  const lab = new User({
    name: 'Lab Technician', email: 'lab@demo.com', password, role: 'lab',
    department: 'Pathology', isActive: true
  });

  await admin.save();
  const savedDoctor = await doctor.save();
  patient.assignedDoctor = savedDoctor._id;
  const savedPatient = await patient.save();
  savedDoctor.assignedPatients = [savedPatient._id];
  await savedDoctor.save();
  await lab.save();

  console.log('\n🎉 Demo users created:');
  console.log('  Patient : patient@demo.com / demo123');
  console.log('  Doctor  : doctor@demo.com / demo123');
  console.log('  Admin   : admin@demo.com / demo123');
  console.log('  Lab     : lab@demo.com / demo123');

  // Seed some vitals
  const VitalSigns = require('../models/VitalSigns');
  const { analyzeVitals } = require('./aiEngine');

  const sampleVitals = [
    { heartRate: 88, spo2: 97, temperature: 98.6, stepCount: 5000 },
    { heartRate: 95, spo2: 96, temperature: 99.1, stepCount: 3000 },
    { heartRate: 105, spo2: 94, temperature: 100.2, stepCount: 1000 },
    { heartRate: 110, spo2: 93, temperature: 101.0, stepCount: 500 },
    { heartRate: 78, spo2: 98, temperature: 98.4, stepCount: 7000 },
    { heartRate: 72, spo2: 99, temperature: 98.2, stepCount: 8500 },
    { heartRate: 85, spo2: 97, temperature: 98.7, stepCount: 6000 },
  ];

  const now = new Date();
  for (let i = 0; i < sampleVitals.length; i++) {
    const v = sampleVitals[i];
    const ai = analyzeVitals(v.heartRate, v.spo2, v.temperature, v.stepCount);
    const date = new Date(now);
    date.setDate(date.getDate() - (sampleVitals.length - 1 - i));

    await new VitalSigns({
      patientId: savedPatient._id,
      ...v,
      aiScore: ai.score,
      aiStatus: ai.status,
      aiReasons: ai.reasons,
      aiRecommendation: ai.recommendation,
      recordedAt: date
    }).save();
  }
  console.log('✅ Sample vitals seeded for demo patient\n');

  mongoose.disconnect();
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
