/**
 * CareLink AI Risk Scoring Engine
 * Rule-based health risk analysis
 * Input: heartRate, spo2, temperature, stepCount
 * Output: score (0-100), status, reasons[], recommendation
 */

const analyzeVitals = (heartRate, spo2, temperature, stepCount = 0) => {
  let score = 0;
  const reasons = [];

  // --- Heart Rate Analysis ---
  if (heartRate > 120) {
    score += 50;
    reasons.push(`Severe tachycardia: Heart rate ${heartRate} bpm (>120)`);
  } else if (heartRate > 100) {
    score += 30;
    reasons.push(`Elevated heart rate: ${heartRate} bpm (>100)`);
  } else if (heartRate < 50) {
    score += 30;
    reasons.push(`Bradycardia detected: Heart rate ${heartRate} bpm (<50)`);
  } else if (heartRate < 60) {
    score += 10;
    reasons.push(`Slightly low heart rate: ${heartRate} bpm`);
  }

  // --- SpO2 Analysis ---
  if (spo2 < 90) {
    score += 50;
    reasons.push(`Severe hypoxia: SpO2 ${spo2}% (<90%) — Critical oxygen level`);
  } else if (spo2 < 95) {
    score += 25;
    reasons.push(`Low oxygen saturation: SpO2 ${spo2}% (<95%)`);
  } else if (spo2 < 97) {
    score += 10;
    reasons.push(`Slightly below normal SpO2: ${spo2}%`);
  }

  // --- Temperature Analysis ---
  if (temperature > 103) {
    score += 30;
    reasons.push(`High fever: Temperature ${temperature}°F (>103°F)`);
  } else if (temperature > 100) {
    score += 15;
    reasons.push(`Mild fever: Temperature ${temperature}°F (>100°F)`);
  } else if (temperature < 96) {
    score += 20;
    reasons.push(`Hypothermia risk: Temperature ${temperature}°F (<96°F)`);
  }

  // --- Activity-Aware Correction (Step Count) ---
  // High step count can cause elevated HR → reduce false positive
  if (stepCount > 8000 && heartRate > 100 && heartRate <= 120) {
    score = Math.max(0, score - 15);
    reasons.push(`Note: Elevated HR may be activity-related (${stepCount} steps recorded)`);
  }

  // Cap score at 100
  score = Math.min(100, Math.max(0, score));

  // --- Classification ---
  let status, recommendation;
  if (score >= 70) {
    status = 'Critical';
    recommendation = 'Immediate medical attention required. Doctor has been alerted. If symptoms worsen, press SOS button.';
  } else if (score >= 40) {
    status = 'Risk';
    recommendation = 'Vitals are elevated. Doctor has been notified. Rest and monitor closely. Stay hydrated.';
  } else {
    status = 'Normal';
    recommendation = 'All vitals are within normal range. Continue your healthy routine.';
  }

  if (reasons.length === 0) {
    reasons.push('All vitals within normal range');
  }

  return { score, status, reasons, recommendation };
};

/**
 * Detect trending — returns 'Improving', 'Worsening', 'Stable'
 */
const analyzeTrend = (scoreHistory) => {
  if (!scoreHistory || scoreHistory.length < 3) return 'Insufficient data';
  const recent = scoreHistory.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;
  if (diff >= 15) return 'Worsening';
  if (diff <= -15) return 'Improving';
  return 'Stable';
};

module.exports = { analyzeVitals, analyzeTrend };
