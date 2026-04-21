// patient.js — Patient Portal Logic

let currentUser = null;
let trendChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('patient')) return;
  currentUser = getUser();
  initSidebar();

  // Clock
  setInterval(() => {
    document.getElementById('currentDateTime').textContent =
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);

  loadOverviewData();
  loadTrendChart();
  loadAlerts();
  loadDoctor();
});

function showSection(section, navEl) {
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${section}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const titles = {
    overview: ['Overview', 'Welcome back! Here\'s your health summary.'],
    vitals: ['My Vitals', 'Submit readings & view AI analysis'],
    medication: ['Medication', 'Track your daily medications'],
    appointments: ['Appointments', 'Your upcoming doctor visits'],
    reports: ['Lab Reports', 'Upload and view your medical reports'],
    diet: ['Diet Plan', 'Your personalised nutrition plan']
  };
  document.getElementById('pageTitle').textContent = titles[section][0];
  document.getElementById('pageSubtitle').textContent = titles[section][1];

  if (section === 'vitals') loadVitalsHistory();
  if (section === 'medication') loadMedications();
  if (section === 'reports') loadReports();
  if (section === 'diet') loadDietPlan();
}

// ═══════════════════════
// OVERVIEW
// ═══════════════════════
async function loadOverviewData() {
  const res = await apiRequest(`/vitals/${currentUser.id}/latest`);
  if (!res || !res.data) return;
  const v = res.data;

  document.getElementById('overviewHR').textContent = v.heartRate || '—';
  document.getElementById('overviewSpO2').textContent = v.spo2 ? `${v.spo2}%` : '—';
  document.getElementById('overviewTemp').textContent = v.temperature ? `${v.temperature}°` : '—';
  document.getElementById('overviewScore').textContent = v.aiScore ?? '—';

  // Update live vitals side
  document.getElementById('liveHR').textContent = v.heartRate || '—';
  document.getElementById('liveSpO2').textContent = v.spo2 || '—';
  document.getElementById('liveTemp').textContent = v.temperature || '—';
  document.getElementById('liveBP').textContent = v.systolicBP ? `${v.systolicBP}/${v.diastolicBP}` : '—';

  // AI Ring
  updateAIRing(v.aiScore, v.aiStatus, v.aiReasons, v.aiRecommendation, v.recordedAt);

  // Health goals
  const steps = v.stepCount || 0;
  const stepPct = Math.min(100, (steps / 10000) * 100);
  document.getElementById('stepsGoal').textContent = `${steps.toLocaleString()} / 10,000`;
  document.getElementById('stepsBar').style.width = stepPct + '%';
}

function updateAIRing(score, status, reasons, recommendation, time) {
  const circle = document.getElementById('aiScoreCircle');
  const scoreVal = document.getElementById('aiScoreVal');
  const statusBadge = document.getElementById('aiStatusBadge');
  const aiScoreTime = document.getElementById('aiScoreTime');
  const aiReasons = document.getElementById('aiReasons');
  const aiRec = document.getElementById('aiRecommendation');

  const colors = { Normal: 'var(--status-normal)', Risk: 'var(--status-risk)', Critical: 'var(--status-critical)' };
  const color = colors[status] || 'var(--primary)';
  const circumference = 364;
  const offset = circumference - ((score / 100) * circumference);

  circle.style.strokeDashoffset = offset;
  circle.style.stroke = color;
  scoreVal.textContent = score ?? '—';
  scoreVal.style.color = color;
  statusBadge.innerHTML = getStatusBadge(status);
  aiScoreTime.textContent = time ? `Last updated: ${formatDateTime(time)}` : '';

  if (reasons?.length) {
    aiReasons.innerHTML = reasons.map(r =>
      `<div style="font-size:12px;color:var(--text-secondary);display:flex;gap:8px;align-items:flex-start">
        <span style="color:${color};margin-top:2px">▸</span><span>${r}</span>
      </div>`
    ).join('');
  }

  if (recommendation) {
    aiRec.innerHTML = `<span style="color:${color}">💡 </span>${recommendation}`;
  }

  // Sync to overview
  document.getElementById('overviewScore').textContent = score ?? '—';
}

// ═══════════════════════
// TREND CHART
// ═══════════════════════
async function loadTrendChart() {
  const res = await apiRequest(`/ai/history/${currentUser.id}`);
  if (!res || !res.data) return;
  const { history, trend } = res.data;

  const trendBadge = document.getElementById('trendBadge');
  const trendColors = { Worsening: 'badge-critical', Improving: 'badge-normal', Stable: 'badge-risk' };
  if (trendBadge) {
    trendBadge.className = `badge ${trendColors[trend] || 'badge-normal'}`;
    trendBadge.textContent = trend || '—';
  }

  const ctx = document.getElementById('trendChart')?.getContext('2d');
  if (!ctx) return;

  if (trendChartInstance) trendChartInstance.destroy();

  const labels = history.map(h => formatDate(h.date));
  const scores = history.map(h => h.score);

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'AI Risk Score',
        data: scores,
        borderColor: '#00d4aa',
        backgroundColor: 'rgba(0,212,170,0.1)',
        pointBackgroundColor: scores.map(s =>
          s >= 70 ? '#ff4757' : s >= 40 ? '#fdcb6e' : '#00d4aa'
        ),
        pointBorderColor: 'transparent',
        pointRadius: 6,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,28,45,0.95)',
          titleColor: '#8899bb',
          bodyColor: '#f0f4ff',
          borderColor: 'rgba(0,212,170,0.2)',
          borderWidth: 1,
          callbacks: {
            label: ctx => `Score: ${ctx.raw} — ${ctx.raw >= 70 ? '🔴 Critical' : ctx.raw >= 40 ? '🟡 Risk' : '🟢 Normal'}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#4a5878', font: { size: 11 } }
        },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#4a5878', font: { size: 11 } }
        }
      }
    }
  });
}

// ═══════════════════════
// ALERTS
// ═══════════════════════
async function loadAlerts() {
  const res = await apiRequest(`/alerts/patient/${currentUser.id}`);
  if (!res || !res.ok) return;
  const alerts = res.data.filter(a => !a.resolved).slice(0, 5);

  const container = document.getElementById('patientAlerts');
  const countBadge = document.getElementById('alertCount');

  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No active alerts</div></div>';
    return;
  }

  countBadge.style.display = 'inline-flex';
  countBadge.textContent = alerts.length + ' active';

  container.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.type.toLowerCase()}">
      <div class="alert-dot"></div>
      <div class="alert-content">
        <div class="alert-message">${a.message}</div>
        <div class="alert-meta">${timeAgo(a.createdAt)} • ${a.type}</div>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════
// DOCTOR INFO
// ═══════════════════════
async function loadDoctor() {
  const res = await apiRequest(`/patients/${currentUser.id}`);
  if (!res || !res.ok || !res.data?.assignedDoctor) return;
  const doc = res.data.assignedDoctor;

  document.getElementById('doctorInfo').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex-shrink:0">
        ${doc.name.charAt(0)}
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${doc.name}</div>
        <div style="font-size:13px;color:var(--text-muted)">${doc.specialization || 'General Physician'}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">📧 ${doc.email}</div>
        ${doc.phone ? `<div style="font-size:13px;color:var(--text-secondary)">📞 ${doc.phone}</div>` : ''}
      </div>
    </div>
  `;
}

// ═══════════════════════
// VITALS SUBMIT
// ═══════════════════════
async function submitVitals(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Analyzing...';

  const payload = {
    heartRate: +document.getElementById('vHR').value,
    spo2: +document.getElementById('vSpO2').value,
    temperature: +document.getElementById('vTemp').value,
    systolicBP: +document.getElementById('vBPSys').value || undefined,
    diastolicBP: +document.getElementById('vBPDia').value || undefined,
    stepCount: +document.getElementById('vSteps').value || 0,
    weight: +document.getElementById('vWeight').value || undefined,
    glucoseLevel: +document.getElementById('vGlucose').value || undefined,
  };

  const res = await apiRequest('/vitals', { method: 'POST', body: payload });
  btn.disabled = false;
  btn.textContent = 'Submit Vitals & Run AI Analysis';

  if (!res || !res.ok) {
    showToast('Failed to submit vitals', 'error');
    return;
  }

  const { vitals, ai } = res.data;
  showToast(`Vitals submitted! AI Score: ${ai.score}/100 — ${ai.status}`,
    ai.status === 'Critical' ? 'error' : ai.status === 'Risk' ? 'warning' : 'success');

  // Update live readings
  document.getElementById('liveHR').textContent = vitals.heartRate;
  document.getElementById('liveSpO2').textContent = vitals.spo2;
  document.getElementById('liveTemp').textContent = vitals.temperature;
  document.getElementById('liveBP').textContent = vitals.systolicBP ? `${vitals.systolicBP}/${vitals.diastolicBP}` : '—';

  // Show AI result
  const colors = { Normal: 'var(--status-normal)', Risk: 'var(--status-risk)', Critical: 'var(--status-critical)' };
  const color = colors[ai.status];
  document.getElementById('vitalsAiResult').style.display = 'block';
  document.getElementById('vitalsAiContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      ${getStatusBadge(ai.status)}
      <span style="font-size:22px;font-weight:800;color:${color}">${ai.score}<span style="font-size:14px;color:var(--text-muted)">/100</span></span>
    </div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${ai.recommendation}</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${ai.reasons.map(r => `<div style="font-size:12px;color:var(--text-muted)">▸ ${r}</div>`).join('')}
    </div>
  `;

  updateAIRing(ai.score, ai.status, ai.reasons, ai.recommendation, new Date());
  loadVitalsHistory();
  loadTrendChart();
  e.target.reset();
}

// ═══════════════════════
// VITALS HISTORY
// ═══════════════════════
async function loadVitalsHistory() {
  const res = await apiRequest(`/vitals/${currentUser.id}?limit=10`);
  if (!res || !res.ok) return;

  const tbody = document.getElementById('vitalsTable');
  if (!res.data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No vitals recorded yet</td></tr>';
    return;
  }

  tbody.innerHTML = res.data.map(v => `
    <tr>
      <td>${formatDateTime(v.recordedAt)}</td>
      <td>${v.heartRate} bpm</td>
      <td>${v.spo2}%</td>
      <td>${v.temperature}°F</td>
      <td>${v.systolicBP ? `${v.systolicBP}/${v.diastolicBP}` : '—'}</td>
      <td style="font-weight:700;color:${v.aiScore >= 70 ? 'var(--status-critical)' : v.aiScore >= 40 ? 'var(--status-risk)' : 'var(--status-normal)'}">${v.aiScore}</td>
      <td>${getStatusBadge(v.aiStatus)}</td>
    </tr>
  `).join('');
}

// ═══════════════════════
// MEDICATIONS
// ═══════════════════════
async function loadMedications() {
  const res = await apiRequest(`/medication/${currentUser.id}`);
  const list = document.getElementById('medicationList');
  const progress = document.getElementById('medProgress');

  if (!res || !res.ok || !res.data.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">💊</div><div class="empty-text">No medications prescribed yet</div></div>';
    return;
  }

  const meds = res.data;
  const taken = meds.filter(m => m.takenToday).length;
  progress.textContent = `${taken} / ${meds.length} taken`;
  progress.className = `badge ${taken === meds.length ? 'badge-normal' : 'badge-pending'}`;

  list.innerHTML = meds.map(m => `
    <div class="med-item ${m.takenToday ? 'taken' : ''}" id="med-${m._id}">
      <div class="med-check" onclick="markMedTaken('${m._id}')">
        ${m.takenToday ? '✓' : ''}
      </div>
      <div class="med-info">
        <div class="med-name">${m.name}</div>
        <div class="med-dosage">${m.dosage} • ${m.frequency}</div>
        ${m.instructions ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${m.instructions}</div>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text-muted)">Dr. ${m.doctorId?.name || '—'}</div>
    </div>
  `).join('');
}

async function markMedTaken(id) {
  const res = await apiRequest(`/medication/${id}/taken`, { method: 'PUT' });
  if (res?.ok) {
    showToast('Medication marked as taken ✅', 'success');
    loadMedications();
  }
}

// ═══════════════════════
// REPORTS
// ═══════════════════════
async function loadReports() {
  const res = await apiRequest(`/reports/${currentUser.id}`);
  const list = document.getElementById('reportsList');

  if (!res || !res.ok || !res.data.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No reports uploaded yet</div></div>';
    return;
  }

  list.innerHTML = res.data.map(r => `
    <div class="report-card">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="report-type-icon">${getReportEmoji(r.reportType)}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600">${getReportTypeLabel(r.reportType)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${r.labName || 'Lab'} • ${formatDate(r.testDate)}</div>
        </div>
        ${getStatusBadge(r.status)}
      </div>
      ${r.patientNote ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">📝 ${r.patientNote}</div>` : ''}
      ${r.doctorComment ? `
        <div style="background:rgba(0,212,170,0.06);border:1px solid rgba(0,212,170,0.15);border-radius:var(--radius-sm);padding:10px;font-size:12px;margin-top:4px">
          <div style="color:var(--primary);font-weight:600;margin-bottom:4px">🩺 Doctor's Comment:</div>
          <div style="color:var(--text-secondary)">${r.doctorComment}</div>
          ${r.severity ? `<div style="margin-top:6px">${getStatusBadge(r.severity)}</div>` : ''}
        </div>` : ''}
      <div style="font-size:11px;color:var(--text-muted)">${timeAgo(r.createdAt)}</div>
    </div>
  `).join('');
}

async function uploadReport(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('reportType', document.getElementById('rType').value);
  formData.append('labName', document.getElementById('rLab').value);
  formData.append('testDate', document.getElementById('rDate').value);
  formData.append('patientNote', document.getElementById('rNote').value);
  const file = document.getElementById('rFile').files[0];
  if (file) formData.append('file', file);

  const res = await apiRequest('/reports/upload', {
    method: 'POST',
    body: formData
  });

  btn.disabled = false;
  btn.textContent = 'Upload Report';

  if (res?.ok) {
    showToast('Report uploaded successfully! Doctor will review soon.', 'success');
    e.target.reset();
    loadReports();
  } else {
    showToast(res?.data?.message || 'Upload failed', 'error');
  }
}

// ═══════════════════════
// DIET PLAN
// ═══════════════════════
async function loadDietPlan() {
  const res = await apiRequest(`/medication/diet/${currentUser.id}`);
  const container = document.getElementById('dietPlanContent');

  if (!res || !res.ok || !res.data) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🥗</div><div class="empty-text">No diet plan assigned yet.</div></div>';
    return;
  }

  const diet = res.data;
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${diet.calories ? `<div class="stat-card" style="--card-text:var(--primary)"><div class="stat-icon">🔥</div><div class="stat-value">${diet.calories}</div><div class="stat-label">Daily Calories</div></div>` : ''}
      <div style="white-space:pre-line;font-size:14px;line-height:1.8;color:var(--text-secondary)">${diet.plan}</div>
      ${diet.notes ? `<div style="background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.2);border-radius:var(--radius-md);padding:14px;font-size:13px;color:var(--text-secondary)"><strong style="color:var(--secondary)">📌 Doctor's Notes:</strong><br/>${diet.notes}</div>` : ''}
    </div>
  `;
}

// ═══════════════════════
// SOS
// ═══════════════════════
async function triggerSOS() {
  if (!confirm('⚠️ Are you sure you want to send an emergency SOS alert to your doctor and the admin? This should only be used in a real emergency.')) return;

  const res = await apiRequest('/alerts/sos', { method: 'POST' });
  if (res?.ok) {
    showToast('🚨 SOS ALERT SENT! Your doctor has been notified immediately.', 'error');
  } else {
    showToast('Failed to send SOS. Please call emergency services directly.', 'error');
  }
}

function getReportEmoji(type) {
  const map = { blood_test: '🩸', ecg: '💓', xray: '🦴', mri: '🧠', urine: '🧪', ct_scan: '🔬', other: '📄' };
  return map[type] || '📄';
}
