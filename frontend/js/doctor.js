// doctor.js — Doctor Portal Logic

// Resolve file URL — handles both old relative and new absolute paths
function getFileUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

let currentUser = null;
let allPatients = [];
let selectedPatientId = null;
let currentReportId = null;
let hrChart, spo2Chart, tempChart, aiTrendChart;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('doctor')) return;
  currentUser = getUser();
  initSidebar();

  setInterval(() => {
    document.getElementById('currentDateTime').textContent =
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);

  loadDashboard();
  loadAllPatients();
});

function showSection(section, navEl) {
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${section}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Patient monitoring overview'],
    patients: ['My Patients', 'All assigned patients'],
    vitals: ['Vitals Monitor', 'Real-time vitals tracking'],
    ai: ['AI Analysis', 'Risk scoring and decision support'],
    reports: ['Lab Reports', 'Review and flag patient reports'],
    alerts: ['Alerts', 'Critical and risk notifications']
  };
  document.getElementById('pageTitle').textContent = titles[section]?.[0] || section;
  document.getElementById('pageSubtitle').textContent = titles[section]?.[1] || '';

  if (section === 'reports') loadDoctorReports();
  if (section === 'alerts') loadDocAlerts();
}

// ═══════════════════════════
// DASHBOARD
// ═══════════════════════════
async function loadDashboard() {
  const res = await apiRequest('/patients');
  if (!res || !res.ok) return;
  allPatients = res.data;

  // Load latest vitals for each patient to determine status
  const patientsWithStatus = await Promise.all(allPatients.map(async p => {
    const vRes = await apiRequest(`/vitals/${p._id}/latest`);
    return { ...p, latestVitals: vRes?.data || null };
  }));

  allPatients = patientsWithStatus;

  const critical = patientsWithStatus.filter(p => p.latestVitals?.aiStatus === 'Critical');
  const risk = patientsWithStatus.filter(p => p.latestVitals?.aiStatus === 'Risk');

  document.getElementById('statTotal').textContent = patientsWithStatus.length;
  document.getElementById('statCritical').textContent = critical.length;
  document.getElementById('statRisk').textContent = risk.length;

  // Critical + risk patients
  const attenList = [...critical, ...risk];
  const container = document.getElementById('criticalPatients');
  if (!attenList.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">All patients are stable</div></div>';
  } else {
    container.innerHTML = attenList.slice(0, 6).map(p => renderPatientRow(p)).join('');
  }

  // Alerts
  const aRes = await apiRequest('/alerts?resolved=false');
  if (aRes?.ok) {
    const alerts = aRes.data;
    document.getElementById('statAlerts').textContent = alerts.length;

    // Update nav badge
    const badge = document.getElementById('alertNavBadge');
    if (alerts.length > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = alerts.length;
    }

    const feed = document.getElementById('dashboardAlerts');
    feed.innerHTML = alerts.slice(0, 5).map(a => `
      <div class="alert-item ${a.type.toLowerCase()}">
        <div class="alert-dot"></div>
        <div class="alert-content">
          <div class="alert-message">${a.message}</div>
          <div class="alert-meta">${a.patientId?.name || 'Unknown'} • ${timeAgo(a.createdAt)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="resolveAlert('${a._id}')">Resolve</button>
      </div>
    `).join('') || '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No active alerts</div></div>';
  }

  // Pending reports
  const rRes = await apiRequest('/reports');
  if (rRes?.ok) {
    const pending = rRes.data.filter(r => r.status === 'Pending');
    const grid = document.getElementById('pendingReportsGrid');
    if (!pending.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No pending reports</div></div>';
    } else {
      grid.innerHTML = pending.slice(0, 6).map(r => renderReportMiniCard(r)).join('');
    }
  }

  populatePatientDropdowns();
}

function renderPatientRow(p) {
  const status = p.latestVitals?.aiStatus || 'Normal';
  const score = p.latestVitals?.aiScore ?? '—';
  const colors = { Critical: 'var(--status-critical)', Risk: 'var(--status-risk)', Normal: 'var(--status-normal)' };
  return `
    <div class="alert-item ${status.toLowerCase()}" style="cursor:pointer;margin-bottom:8px" onclick="openPatientModal('${p._id}')">
      <div class="alert-dot"></div>
      <div class="alert-content">
        <div class="alert-message">${p.name} <span style="font-size:11px;color:var(--text-muted)">• Age ${p.age || '—'}</span></div>
        <div class="alert-meta">Score: <strong style="color:${colors[status]}">${score}/100</strong> • ${getStatusBadge(status)}</div>
      </div>
    </div>
  `;
}

function renderReportMiniCard(r) {
  return `
    <div class="report-card" style="cursor:pointer" onclick="openReviewModal('${r._id}','${r.patientId?.name || 'Patient'}','${r.reportType}','${r.patientNote || ''}')">
      <div style="display:flex;gap:10px;align-items:center">
        <div class="report-type-icon" style="width:40px;height:40px;font-size:20px">${getReportEmoji(r.reportType)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${r.patientId?.name || 'Patient'}</div>
          <div style="font-size:11px;color:var(--text-muted)">${getReportTypeLabel(r.reportType)}</div>
        </div>
        ${getStatusBadge(r.status)}
      </div>
    </div>
  `;
}

// ═══════════════════════════
// PATIENTS
// ═══════════════════════════
async function loadAllPatients() {
  if (!allPatients.length) {
    const res = await apiRequest('/patients');
    if (!res || !res.ok) return;
    const patientsWithStatus = await Promise.all(res.data.map(async p => {
      const vRes = await apiRequest(`/vitals/${p._id}/latest`);
      return { ...p, latestVitals: vRes?.data || null };
    }));
    allPatients = patientsWithStatus;
  }
  renderPatientGrid(allPatients);
  populatePatientDropdowns();
}

function renderPatientGrid(patients) {
  const grid = document.getElementById('patientGrid');
  if (!patients.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👥</div><div class="empty-text">No patients assigned</div></div>';
    return;
  }
  grid.innerHTML = patients.map(p => {
    const status = p.latestVitals?.aiStatus || 'Normal';
    const score = p.latestVitals?.aiScore ?? '—';
    const colors = { Critical: 'var(--status-critical)', Risk: 'var(--status-risk)', Normal: 'var(--status-normal)' };
    return `
      <div class="patient-card" onclick="openPatientModal('${p._id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div class="patient-avatar">${p.name.charAt(0)}</div>
          ${getStatusBadge(status)}
        </div>
        <div style="font-size:16px;font-weight:700">${p.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${p.age ? `Age ${p.age}` : ''} ${p.gender ? `• ${p.gender}` : ''} ${p.bloodGroup ? `• ${p.bloodGroup}` : ''}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:11px;color:var(--text-muted)">AI Score</div>
            <div style="font-size:20px;font-weight:800;color:${colors[status]}">${score}</div>
          </div>
          ${p.latestVitals ? `
            <div style="display:flex;flex-direction:column;gap:4px;text-align:right">
              <div style="font-size:11px;color:var(--text-muted)">HR: <strong>${p.latestVitals.heartRate}</strong></div>
              <div style="font-size:11px;color:var(--text-muted)">SpO2: <strong>${p.latestVitals.spo2}%</strong></div>
              <div style="font-size:11px;color:var(--text-muted)">Temp: <strong>${p.latestVitals.temperature}°F</strong></div>
            </div>` : '<div style="font-size:12px;color:var(--text-muted)">No readings</div>'}
        </div>
      </div>
    `;
  }).join('');
}

function filterPatients() {
  const search = document.getElementById('patientSearch').value.toLowerCase();
  const statusFilter = document.getElementById('patientStatusFilter').value;
  const filtered = allPatients.filter(p => {
    const matchName = p.name.toLowerCase().includes(search);
    const matchStatus = !statusFilter || (p.latestVitals?.aiStatus === statusFilter);
    return matchName && matchStatus;
  });
  renderPatientGrid(filtered);
}

function populatePatientDropdowns() {
  ['vitalsPatientSelect', 'aiPatientSelect'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select a patient --</option>' +
      allPatients.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
  });
}

// ═══════════════════════════
// VITALS MONITOR
// ═══════════════════════════
async function loadPatientVitals() {
  const pid = document.getElementById('vitalsPatientSelect').value;
  if (!pid) return;
  selectedPatientId = pid;

  document.getElementById('vitalsMonitorContent').style.display = 'block';

  const res = await apiRequest(`/vitals/${pid}?limit=14`);
  if (!res || !res.ok || !res.data.length) return;

  const vitals = res.data.reverse(); // oldest first
  const latest = vitals[vitals.length - 1];
  const labels = vitals.map(v => formatDate(v.recordedAt));

  // Live cards
  const status = latest.aiStatus;
  const colors = { Critical: 'var(--status-critical)', Risk: 'var(--status-risk)', Normal: 'var(--status-normal)' };
  document.getElementById('vitalsLiveCards').innerHTML = `
    <div class="vital-card ${status === 'Critical' ? 'vital-danger' : status === 'Risk' ? 'vital-warning' : 'vital-normal'}">
      <span class="vital-icon">💓</span>
      <div class="vital-value">${latest.heartRate}</div>
      <span class="vital-unit">bpm</span>
      <div class="vital-label">Heart Rate</div>
    </div>
    <div class="vital-card vital-normal">
      <span class="vital-icon">🫁</span>
      <div class="vital-value" style="color:#74b9ff">${latest.spo2}</div>
      <span class="vital-unit">%</span>
      <div class="vital-label">SpO2</div>
    </div>
    <div class="vital-card vital-normal">
      <span class="vital-icon">🌡️</span>
      <div class="vital-value" style="color:#fdcb6e">${latest.temperature}</div>
      <span class="vital-unit">°F</span>
      <div class="vital-label">Temperature</div>
    </div>
    <div class="vital-card" style="--vital-color:${colors[status]}">
      <span class="vital-icon">🤖</span>
      <div class="vital-value" style="color:${colors[status]}">${latest.aiScore}</div>
      <span class="vital-unit">/100</span>
      <div class="vital-label">AI Score — ${status}</div>
    </div>
  `;

  buildVitalChart('hrChart', labels, vitals.map(v => v.heartRate), 'Heart Rate', '#ff6b9d', 60, 180);
  buildVitalChart('spo2Chart', labels, vitals.map(v => v.spo2), 'SpO2', '#74b9ff', 80, 100);
  buildVitalChart('tempChart', labels, vitals.map(v => v.temperature), 'Temperature °F', '#fdcb6e', 96, 106);
}

function buildVitalChart(id, labels, data, label, color, min, max) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  if (window[`chart_${id}`]) window[`chart_${id}`].destroy();
  window[`chart_${id}`] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label, data,
        borderColor: color,
        backgroundColor: color + '18',
        pointBackgroundColor: color,
        pointBorderColor: 'transparent',
        pointRadius: 5, tension: 0.4, fill: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(17,28,45,0.95)', titleColor: '#8899bb', bodyColor: '#f0f4ff', borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1 } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5878', font: { size: 11 } } },
        y: { min, max, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#4a5878', font: { size: 11 } } }
      }
    }
  });
}

async function addMedication(e) {
  e.preventDefault();
  if (!selectedPatientId) { showToast('Select a patient first', 'warning'); return; }
  const res = await apiRequest('/medication', {
    method: 'POST',
    body: {
      patientId: selectedPatientId,
      name: document.getElementById('medName').value,
      dosage: document.getElementById('medDosage').value,
      frequency: document.getElementById('medFreq').value,
      instructions: document.getElementById('medInstr').value
    }
  });
  if (res?.ok) { showToast('Medication added successfully', 'success'); e.target.reset(); }
  else showToast('Failed to add medication', 'error');
}

async function addDietPlan(e) {
  e.preventDefault();
  if (!selectedPatientId) { showToast('Select a patient first', 'warning'); return; }
  const res = await apiRequest('/medication/diet', {
    method: 'POST',
    body: {
      patientId: selectedPatientId,
      plan: document.getElementById('dietPlan').value,
      calories: +document.getElementById('dietCal').value || undefined,
      notes: document.getElementById('dietNotes').value
    }
  });
  if (res?.ok) { showToast('Diet plan saved!', 'success'); e.target.reset(); }
  else showToast('Failed to save diet plan', 'error');
}

// ═══════════════════════════
// AI ANALYSIS
// ═══════════════════════════
async function loadAIAnalysis() {
  const pid = document.getElementById('aiPatientSelect').value;
  if (!pid) return;

  document.getElementById('aiAnalysisContent').style.display = 'block';

  const [analysisRes, historyRes] = await Promise.all([
    apiRequest(`/ai/analyze/${pid}`),
    apiRequest(`/ai/history/${pid}`)
  ]);

  if (analysisRes?.ok) {
    const { ai } = analysisRes.data;
    const colors = { Normal: 'var(--status-normal)', Risk: 'var(--status-risk)', Critical: 'var(--status-critical)' };
    const color = colors[ai.status];
    const circumference = 364;
    const offset = circumference - ((ai.score / 100) * circumference);
    const circle = document.getElementById('docAiCircle');
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = color;
    document.getElementById('docAiScore').textContent = ai.score;
    document.getElementById('docAiScore').style.color = color;
    document.getElementById('docAiStatusBadge').innerHTML = getStatusBadge(ai.status);
    document.getElementById('docAiReasons').innerHTML = ai.reasons.map(r =>
      `<div style="font-size:12px;color:var(--text-secondary);display:flex;gap:8px"><span style="color:${color}">▸</span>${r}</div>`
    ).join('');
    document.getElementById('docAiRec').innerHTML = `💡 ${ai.recommendation}`;

    // Decision support
    const decisions = {
      Critical: `<div style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);border-radius:var(--radius-md);padding:16px">
        <div style="font-weight:700;color:var(--danger);margin-bottom:8px">🚨 Immediate Action Required</div>
        <ul style="font-size:13px;color:var(--text-secondary);line-height:2;padding-left:16px">
          <li>Consider hospitalisation or immediate intervention</li>
          <li>Review current medication plan for adequacy</li>
          <li>Schedule urgent in-person or video consultation</li>
          <li>Alert family members / emergency contacts if unresponsive</li>
          <li>Order repeat lab tests to confirm findings</li>
        </ul>
      </div>`,
      Risk: `<div style="background:rgba(253,203,110,0.1);border:1px solid rgba(253,203,110,0.3);border-radius:var(--radius-md);padding:16px">
        <div style="font-weight:700;color:var(--warning);margin-bottom:8px">⚠️ Monitor Closely</div>
        <ul style="font-size:13px;color:var(--text-secondary);line-height:2;padding-left:16px">
          <li>Schedule follow-up within 24–48 hours</li>
          <li>Review vitals trend over the past 7 days</li>
          <li>Assess current medication compliance</li>
          <li>Advise patient to rest and stay hydrated</li>
          <li>Consider adjusting dosage if flagged vitals persist</li>
        </ul>
      </div>`,
      Normal: `<div style="background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:var(--radius-md);padding:16px">
        <div style="font-weight:700;color:var(--primary);margin-bottom:8px">✅ Patient is Stable</div>
        <ul style="font-size:13px;color:var(--text-secondary);line-height:2;padding-left:16px">
          <li>Continue current treatment plan</li>
          <li>Routine follow-up as scheduled</li>
          <li>Encourage healthy lifestyle — diet and exercise</li>
          <li>Monitor weekly vitals</li>
        </ul>
      </div>`
    };
    document.getElementById('aiDecisionContent').innerHTML = decisions[ai.status] || '';
  }

  if (historyRes?.ok) {
    const { history, trend } = historyRes.data;
    const trendEl = document.getElementById('docTrendBadge');
    trendEl.textContent = trend;
    trendEl.className = `badge ${trend === 'Worsening' ? 'badge-critical' : trend === 'Improving' ? 'badge-normal' : 'badge-risk'}`;

    const ctx = document.getElementById('aiTrendChart')?.getContext('2d');
    if (ctx) {
      if (window.aiTrendCh) window.aiTrendCh.destroy();
      window.aiTrendCh = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: history.map(h => formatDate(h.date)),
          datasets: [{
            label: 'AI Score',
            data: history.map(h => h.score),
            backgroundColor: history.map(h => h.score >= 70 ? 'rgba(255,71,87,0.6)' : h.score >= 40 ? 'rgba(253,203,110,0.6)' : 'rgba(0,212,170,0.6)'),
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#4a5878' } },
            x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5878' } }
          }
        }
      });
    }
  }
}

// ═══════════════════════════
// REPORTS
// ═══════════════════════════
async function loadDoctorReports() {
  const statusFilter = document.getElementById('reportStatusFilter')?.value;
  const res = await apiRequest('/reports');
  if (!res || !res.ok) return;

  let reports = res.data;
  if (statusFilter) reports = reports.filter(r => r.status === statusFilter);

  const pending = reports.filter(r => r.status === 'Pending').length;
  document.getElementById('pendingCount').textContent = `${pending} pending`;

  const container = document.getElementById('doctorReportsList');
  if (!reports.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No reports found</div></div>';
    return;
  }

  container.innerHTML = reports.map(r => `
    <div class="card">
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div class="report-type-icon">${getReportEmoji(r.reportType)}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <div style="font-size:15px;font-weight:700">${r.patientId?.name || 'Patient'}</div>
            ${getStatusBadge(r.status)}
          </div>
          <div style="font-size:13px;color:var(--text-muted)">${getReportTypeLabel(r.reportType)} • ${r.labName || '—'} • ${formatDate(r.testDate)}</div>
          ${r.patientNote ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:8px;background:rgba(255,255,255,0.03);padding:10px;border-radius:8px">📝 "${r.patientNote}"</div>` : ''}
          ${r.doctorComment ? `<div style="font-size:13px;color:var(--primary);margin-top:8px">✅ Your review: ${r.doctorComment}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          <div style="font-size:11px;color:var(--text-muted)">${timeAgo(r.createdAt)}</div>
          ${r.status === 'Pending' ? `
            <button class="btn btn-primary btn-sm" onclick="openReviewModal('${r._id}','${r.patientId?.name || 'Patient'}','${r.reportType}','${(r.patientNote || '').replace(/'/g, "\\'")}')">
              Review
            </button>` : `<button class="btn btn-ghost btn-sm" onclick="openReviewModal('${r._id}','${r.patientId?.name || 'Patient'}','${r.reportType}','${(r.patientNote || '').replace(/'/g, "\\'")}')">Update</button>`}
          ${r.fileUrl ? `<a href="${getFileUrl(r.fileUrl)}" target="_blank" class="btn btn-ghost btn-sm">📥 View File</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function openReviewModal(id, patientName, type, note) {
  currentReportId = id;
  document.getElementById('reviewReportInfo').innerHTML = `
    <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-md);padding:14px;font-size:13px;color:var(--text-secondary)">
      <strong style="color:var(--text-primary)">${patientName}</strong> — ${getReportTypeLabel(type)}
      ${note ? `<br/><span style="color:var(--text-muted)">Patient note: "${note}"</span>` : ''}
    </div>`;
  document.getElementById('reviewModal').classList.remove('hidden');
}

function closeReviewModal() {
  document.getElementById('reviewModal').classList.add('hidden');
  currentReportId = null;
}

async function submitReview(status) {
  if (!currentReportId) return;
  const comment = document.getElementById('reviewComment').value;
  const severity = document.getElementById('reviewSeverity').value;
  if (!comment.trim()) { showToast('Please enter a clinical comment', 'warning'); return; }

  const res = await apiRequest(`/reports/${currentReportId}/review`, {
    method: 'PUT',
    body: { doctorComment: comment, severity, status }
  });

  if (res?.ok) {
    showToast(`Report ${status === 'Flagged' ? 'flagged as abnormal' : 'marked as reviewed'}`, status === 'Flagged' ? 'warning' : 'success');
    closeReviewModal();
    loadDoctorReports();
  } else {
    showToast('Failed to submit review', 'error');
  }
}

// ═══════════════════════════
// ALERTS
// ═══════════════════════════
async function loadDocAlerts() {
  const res = await apiRequest('/alerts');
  if (!res || !res.ok) return;
  const alerts = res.data;

  const badge = document.getElementById('alertNavBadge');
  const unresolved = alerts.filter(a => !a.resolved).length;
  badge.style.display = unresolved ? 'inline-flex' : 'none';
  badge.textContent = unresolved;

  const container = document.getElementById('doctorAlertsList');
  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No alerts</div></div>';
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div class="card" style="border-left:3px solid ${a.type === 'Critical' || a.type === 'SOS' ? 'var(--status-critical)' : 'var(--status-risk)'}">
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            ${getStatusBadge(a.type)}
            <span style="font-size:13px;font-weight:600">${a.patientId?.name || 'Unknown'}</span>
            ${a.resolved ? '<span class="badge badge-reviewed">✅ Resolved</span>' : ''}
          </div>
          <div style="font-size:14px;color:var(--text-primary);margin-bottom:6px">${a.message}</div>
          ${a.vitals ? `
            <div style="font-size:12px;color:var(--text-muted)">
              HR: ${a.vitals.heartRate}bpm • SpO2: ${a.vitals.spo2}% • Temp: ${a.vitals.temperature}°F
            </div>` : ''}
          ${a.reasons?.length ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${a.reasons.slice(0,2).join(' • ')}</div>` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${formatDateTime(a.createdAt)}</div>
        </div>
        ${!a.resolved ? `<button class="btn btn-ghost btn-sm" onclick="resolveAlert('${a._id}')">Mark Resolved</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function resolveAlert(id) {
  const res = await apiRequest(`/alerts/${id}/resolve`, { method: 'PUT' });
  if (res?.ok) {
    showToast('Alert resolved', 'success');
    loadDocAlerts();
    loadDashboard();
  }
}

// ═══════════════════════════
// PATIENT MODAL
// ═══════════════════════════
async function openPatientModal(pid) {
  const patient = allPatients.find(p => p._id === pid);
  if (!patient) return;

  document.getElementById('patientModalName').textContent = patient.name;
  document.getElementById('patientModal').classList.remove('hidden');

  const status = patient.latestVitals?.aiStatus || 'Normal';
  const colors = { Critical: 'var(--status-critical)', Risk: 'var(--status-risk)', Normal: 'var(--status-normal)' };

  document.getElementById('patientModalContent').innerHTML = `
    <div class="grid-2" style="gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Age / Gender</div>
        <div style="font-size:15px;font-weight:600">${patient.age || '—'} / ${patient.gender || '—'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Blood Group</div>
        <div style="font-size:15px;font-weight:600">${patient.bloodGroup || '—'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Email</div>
        <div style="font-size:14px">${patient.email}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Phone</div>
        <div style="font-size:14px">${patient.phone || '—'}</div>
      </div>
    </div>
    ${patient.latestVitals ? `
      <div class="divider"></div>
      <div style="font-size:14px;font-weight:600;margin-bottom:12px">Latest Vitals</div>
      <div class="vitals-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="vital-card ${status === 'Critical' ? 'vital-danger' : status === 'Risk' ? 'vital-warning' : 'vital-normal'}">
          <span class="vital-icon">💓</span>
          <div class="vital-value">${patient.latestVitals.heartRate}</div>
          <span class="vital-unit">bpm</span>
          <div class="vital-label">Heart Rate</div>
        </div>
        <div class="vital-card vital-normal">
          <span class="vital-icon">🫁</span>
          <div class="vital-value" style="color:#74b9ff">${patient.latestVitals.spo2}</div>
          <span class="vital-unit">%</span>
          <div class="vital-label">SpO2</div>
        </div>
        <div class="vital-card vital-normal">
          <span class="vital-icon">🌡️</span>
          <div class="vital-value" style="color:#fdcb6e">${patient.latestVitals.temperature}</div>
          <span class="vital-unit">°F</span>
          <div class="vital-label">Temperature</div>
        </div>
        <div class="vital-card" style="--vital-color:${colors[status]}">
          <span class="vital-icon">🤖</span>
          <div class="vital-value" style="color:${colors[status]}">${patient.latestVitals.aiScore}</div>
          <span class="vital-unit">/100</span>
          <div class="vital-label">AI Score</div>
        </div>
      </div>
      <div style="margin-top:12px">${getStatusBadge(status)}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-top:8px">${patient.latestVitals.aiRecommendation || ''}</div>
    ` : '<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No vitals recorded for this patient.</div>'}
    <div style="margin-top:20px;display:flex;gap:10px">
      <button class="btn btn-primary btn-sm" onclick="closePatientModal();showSection('vitals',document.getElementById('navVitals'));document.getElementById('vitalsPatientSelect').value='${pid}';loadPatientVitals();">
        📊 View Vitals Monitor
      </button>
      <button class="btn btn-secondary btn-sm" onclick="closePatientModal();showSection('ai',document.getElementById('navAI'));document.getElementById('aiPatientSelect').value='${pid}';loadAIAnalysis();">
        🤖 AI Analysis
      </button>
    </div>
  `;
}

function closePatientModal() {
  document.getElementById('patientModal').classList.add('hidden');
}

function getReportEmoji(type) {
  const map = { blood_test: '🩸', ecg: '💓', xray: '🦴', mri: '🧠', urine: '🧪', ct_scan: '🔬', other: '📄' };
  return map[type] || '📄';
}
