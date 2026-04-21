// admin.js — Admin Portal Logic

let currentUser = null;
let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('admin')) return;
  currentUser = getUser();
  initSidebar();

  setInterval(() => {
    document.getElementById('currentDateTime').textContent =
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);

  loadDashboard();
  loadAllUsers();
});

function showSection(section, navEl) {
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${section}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: ['Admin Dashboard', 'System-wide overview'],
    analytics: ['Analytics', 'System statistics and charts'],
    patients: ['Patient Management', 'All registered patients'],
    doctors: ['Doctor Management', 'All registered doctors'],
    assign: ['Assign Doctor', 'Link doctors to patients'],
    reports: ['Lab Reports', 'System-wide report management'],
    alerts: ['All Alerts', 'System-wide alert feed'],
    settings: ['System Settings', 'Configure AI thresholds and hospital info']
  };
  document.getElementById('pageTitle').textContent = titles[section]?.[0] || section;
  document.getElementById('pageSubtitle').textContent = titles[section]?.[1] || '';

  if (section === 'patients') loadPatients();
  if (section === 'doctors') loadDoctors();
  if (section === 'assign') populateAssignDropdowns();
  if (section === 'reports') loadAdminReports();
  if (section === 'alerts') loadAdminAlerts();
  if (section === 'analytics') loadAnalytics();
}

// ═══════════════════════════
// DASHBOARD
// ═══════════════════════════
async function loadDashboard() {
  const [analyticsRes, alertsRes, usersRes] = await Promise.all([
    apiRequest('/admin/analytics'),
    apiRequest('/alerts'),
    apiRequest('/admin/users')
  ]);

  if (analyticsRes?.ok) {
    const a = analyticsRes.data;
    document.getElementById('statPatients').textContent = a.totalPatients;
    document.getElementById('statDoctors').textContent = a.totalDoctors;
    document.getElementById('statAlerts').textContent = a.unresolvedAlerts;
    document.getElementById('statFlagged').textContent = a.flaggedReports;
  }

  if (alertsRes?.ok) {
    const alerts = alertsRes.data.filter(a => !a.resolved);
    const badge = document.getElementById('alertNavBadge');
    if (alerts.length > 0) { badge.style.display = 'inline-flex'; badge.textContent = alerts.length; }

    const feed = document.getElementById('adminDashAlerts');
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

  if (usersRes?.ok) {
    allUsers = usersRes.data;
    const container = document.getElementById('recentUsers');
    const recent = [...usersRes.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    container.innerHTML = recent.map(u => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${u.name.charAt(0)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${u.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${u.email}</div>
        </div>
        <span class="badge badge-normal" style="font-size:10px">${u.role}</span>
        <div style="font-size:11px;color:var(--text-muted)">${formatDate(u.createdAt)}</div>
      </div>
    `).join('');
  }
}

// ═══════════════════════════
// ANALYTICS
// ═══════════════════════════
async function loadAnalytics() {
  const res = await apiRequest('/admin/analytics');
  if (!res?.ok) return;
  const a = res.data;

  document.getElementById('analyticsStats').innerHTML = `
    <div class="stat-card" style="--card-text:var(--primary)"><div class="stat-icon">🧑‍🦽</div><div class="stat-value">${a.totalPatients}</div><div class="stat-label">Patients</div></div>
    <div class="stat-card" style="--card-text:var(--secondary)"><div class="stat-icon">🩺</div><div class="stat-value" style="color:var(--secondary)">${a.totalDoctors}</div><div class="stat-label">Doctors</div></div>
    <div class="stat-card" style="--card-text:var(--danger)"><div class="stat-icon">🚨</div><div class="stat-value" style="color:var(--danger)">${a.criticalAlerts}</div><div class="stat-label">Critical Alerts</div></div>
    <div class="stat-card" style="--card-text:var(--warning)"><div class="stat-icon">📋</div><div class="stat-value" style="color:var(--warning)">${a.totalReports}</div><div class="stat-label">Total Reports</div></div>
  `;

  // Vitals distribution doughnut
  const vitalBreakdown = a.vitalStatusBreakdown || [];
  const vCtx = document.getElementById('vitalsDistChart')?.getContext('2d');
  if (vCtx) {
    new Chart(vCtx, {
      type: 'doughnut',
      data: {
        labels: vitalBreakdown.map(v => v._id || 'Unknown'),
        datasets: [{ data: vitalBreakdown.map(v => v.count), backgroundColor: ['#ff4757', '#fdcb6e', '#00d4aa'], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8899bb', font: { size: 12 } } }
        }
      }
    });
  }

  // Reports distribution
  const rCtx = document.getElementById('reportDistChart')?.getContext('2d');
  if (rCtx) {
    new Chart(rCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Reviewed', 'Flagged'],
        datasets: [{ data: [a.totalReports - a.flaggedReports, Math.max(0, a.totalReports - a.flaggedReports - (a.totalAlerts || 0)), a.flaggedReports], backgroundColor: ['#74b9ff', '#00d4aa', '#ff4757'], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#8899bb', font: { size: 12 } } } }
      }
    });
  }
}

// ═══════════════════════════
// PATIENTS
// ═══════════════════════════
async function loadPatients() {
  const res = await apiRequest('/admin/users?role=patient');
  if (!res?.ok) return;
  const tbody = document.getElementById('patientsTable');
  if (!res.data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No patients found</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map(p => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${p.name.charAt(0)}</div>
        ${p.name}
      </div></td>
      <td>${p.email}</td>
      <td>${p.age || '—'}</td>
      <td>${p.bloodGroup || '—'}</td>
      <td>${p.assignedDoctor?.name || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td>${formatDate(p.createdAt)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser('${p._id}', loadPatients)">Delete</button></td>
    </tr>
  `).join('');
}

// ═══════════════════════════
// DOCTORS
// ═══════════════════════════
async function loadDoctors() {
  const res = await apiRequest('/admin/users?role=doctor');
  if (!res?.ok) return;
  const tbody = document.getElementById('doctorsTable');
  if (!res.data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No doctors found</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map(d => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--secondary),#a29bfe);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${d.name.charAt(0)}</div>
        ${d.name}
      </div></td>
      <td>${d.email}</td>
      <td>${d.specialization || '—'}</td>
      <td>${d.department || '—'}</td>
      <td>${d.phone || '—'}</td>
      <td>${d.assignedPatients?.length || 0}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser('${d._id}', loadDoctors)">Delete</button></td>
    </tr>
  `).join('');
}

// ═══════════════════════════
// ASSIGN DOCTOR
// ═══════════════════════════
async function populateAssignDropdowns() {
  const [pRes, dRes] = await Promise.all([
    apiRequest('/admin/users?role=patient'),
    apiRequest('/admin/users?role=doctor')
  ]);
  if (pRes?.ok) {
    document.getElementById('assignPatient').innerHTML = '<option value="">-- Select patient --</option>' +
      pRes.data.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
  }
  if (dRes?.ok) {
    document.getElementById('assignDoctor').innerHTML = '<option value="">-- Select doctor --</option>' +
      dRes.data.map(d => `<option value="${d._id}">${d.name} (${d.specialization || 'General'})</option>`).join('');
  }
}

async function populateReportModalDropdowns() {
  const [pRes, dRes] = await Promise.all([
    apiRequest('/admin/users?role=patient'),
    apiRequest('/admin/users?role=doctor')
  ]);
  if (pRes?.ok) {
    document.getElementById('arPatient').innerHTML = '<option value="">-- Select patient --</option>' +
      pRes.data.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
  }
  if (dRes?.ok) {
    document.getElementById('arDoctor').innerHTML = '<option value="">-- Select doctor --</option>' +
      dRes.data.map(d => `<option value="${d._id}">${d.name}</option>`).join('');
  }
}

function openAddReportModal() {
  populateReportModalDropdowns();
  document.getElementById('addReportModal').classList.remove('hidden');
}
function closeAddReportModal() { document.getElementById('addReportModal').classList.add('hidden'); }

async function assignDoctor(e) {
  e.preventDefault();
  const patientId = document.getElementById('assignPatient').value;
  const doctorId = document.getElementById('assignDoctor').value;
  const res = await apiRequest('/admin/assign', { method: 'PUT', body: { patientId, doctorId } });
  if (res?.ok) { showToast('Doctor assigned successfully!', 'success'); e.target.reset(); }
  else showToast('Assignment failed', 'error');
}

// ═══════════════════════════
// REPORTS
// ═══════════════════════════
async function loadAdminReports() {
  const statusFilter = document.getElementById('adminReportFilter')?.value;
  const res = await apiRequest('/reports');
  if (!res?.ok) return;
  let reports = res.data;
  if (statusFilter) reports = reports.filter(r => r.status === statusFilter);

  const tbody = document.getElementById('adminReportsTable');
  if (!reports.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No reports</td></tr>';
    return;
  }
  tbody.innerHTML = reports.map(r => `
    <tr>
      <td>${r.patientId?.name || '—'}</td>
      <td>${getReportTypeLabel(r.reportType)}</td>
      <td>${r.labName || '—'}</td>
      <td style="text-transform:capitalize">${r.uploadedBy}</td>
      <td>${formatDate(r.createdAt)}</td>
      <td>${getStatusBadge(r.status)}</td>
      <td>${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" class="btn btn-ghost btn-sm">📥 View</a>` : '—'}</td>
    </tr>
  `).join('');
}

async function adminAddReport(e) {
  e.preventDefault();
  const formData = new FormData();
  formData.append('patientId', document.getElementById('arPatient').value);
  formData.append('doctorId', document.getElementById('arDoctor').value);
  formData.append('reportType', document.getElementById('arType').value);
  formData.append('labName', document.getElementById('arLab').value);
  formData.append('testDate', document.getElementById('arDate').value);
  const file = document.getElementById('arFile').files[0];
  if (file) formData.append('file', file);

  const res = await apiRequest('/reports/admin-add', { method: 'POST', body: formData });
  if (res?.ok) {
    showToast('Report added successfully', 'success');
    closeAddReportModal();
    loadAdminReports();
  } else {
    showToast(res?.data?.message || 'Failed to add report', 'error');
  }
}

// ═══════════════════════════
// ALERTS
// ═══════════════════════════
async function loadAdminAlerts() {
  const res = await apiRequest('/alerts');
  if (!res?.ok) return;
  const container = document.getElementById('adminAlertsList');
  const unresolved = res.data.filter(a => !a.resolved).length;
  const badge = document.getElementById('alertNavBadge');
  badge.style.display = unresolved ? 'inline-flex' : 'none';
  badge.textContent = unresolved;

  if (!res.data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No alerts</div></div>';
    return;
  }

  container.innerHTML = res.data.map(a => `
    <div class="card" style="border-left:3px solid ${a.type === 'Critical' || a.type === 'SOS' ? 'var(--status-critical)' : 'var(--status-risk)'}">
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
            ${getStatusBadge(a.type)}
            <span style="font-size:13px;font-weight:600">${a.patientId?.name || 'Unknown'}</span>
            ${a.resolved ? '<span class="badge badge-reviewed">✅ Resolved</span>' : ''}
          </div>
          <div style="font-size:14px;color:var(--text-primary);margin-bottom:4px">${a.message}</div>
          <div style="font-size:11px;color:var(--text-muted)">${formatDateTime(a.createdAt)}</div>
        </div>
        ${!a.resolved ? `<button class="btn btn-ghost btn-sm" onclick="resolveAlert('${a._id}')">Resolve</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function resolveAlert(id) {
  const res = await apiRequest(`/alerts/${id}/resolve`, { method: 'PUT' });
  if (res?.ok) { showToast('Alert resolved', 'success'); loadDashboard(); loadAdminAlerts(); }
}

// ═══════════════════════════
// USER MANAGEMENT
// ═══════════════════════════
function openCreateUserModal(role) {
  document.getElementById('createUserModal').classList.remove('hidden');
  if (role) document.getElementById('cuRole').value = role;
}
function closeCreateUserModal() { document.getElementById('createUserModal').classList.add('hidden'); }

async function createUser(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cuName').value,
    email: document.getElementById('cuEmail').value,
    password: document.getElementById('cuPassword').value,
    role: document.getElementById('cuRole').value,
    phone: document.getElementById('cuPhone').value,
    age: +document.getElementById('cuAge').value || undefined,
    gender: document.getElementById('cuGender').value || undefined,
    bloodGroup: document.getElementById('cuBlood').value || undefined,
    specialization: document.getElementById('cuSpec').value || undefined
  };
  const res = await apiRequest('/admin/users', { method: 'POST', body: payload });
  if (res?.ok) {
    showToast('User created successfully!', 'success');
    closeCreateUserModal();
    e.target.reset();
    loadDashboard();
  } else {
    showToast(res?.data?.message || 'Failed to create user', 'error');
  }
}

async function deleteUser(id, reloadFn) {
  if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
  const res = await apiRequest(`/admin/users/${id}`, { method: 'DELETE' });
  if (res?.ok) { showToast('User deleted', 'success'); if (reloadFn) reloadFn(); }
  else showToast('Delete failed', 'error');
}

async function loadAllUsers() {
  const res = await apiRequest('/admin/users');
  if (res?.ok) allUsers = res.data;
}

function filterTable(tableId, query) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;
  Array.from(tbody.rows).forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
  });
}
