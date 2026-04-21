// auth.js — shared auth utilities

// Auto-detect production vs development
const IS_PROD = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const BACKEND_URL = IS_PROD ? 'https://carelink-api-3vzd.onrender.com' : '';
const API_BASE = `${BACKEND_URL}/api`;

function getToken() {
  return localStorage.getItem('carelink_token');
}

function getUser() {
  return JSON.parse(localStorage.getItem('carelink_user') || 'null');
}

function requireAuth(expectedRole) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = IS_PROD ? 'https://carelink-health.netlify.app/index.html' : '/index.html';
    return false;
  }
  if (expectedRole && user.role !== expectedRole) {
    window.location.href = IS_PROD ? 'https://carelink-health.netlify.app/index.html' : '/index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('carelink_token');
  localStorage.removeItem('carelink_user');
  window.location.href = IS_PROD ? 'https://carelink-health.netlify.app/index.html' : '/index.html';
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.body = JSON.stringify(options.body);
  }

  if (options.body instanceof FormData) {
    delete defaultOptions.headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: { ...defaultOptions.headers, ...options.headers }
  });

  if (response.status === 401) {
    logout();
    return null;
  }

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span style="font-size:18px">${icons[type] || 'ℹ️'}</span><span style="flex:1">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function getStatusBadge(status) {
  const map = {
    'Critical': 'badge-critical',
    'Risk': 'badge-risk',
    'Normal': 'badge-normal',
    'Pending': 'badge-pending',
    'Flagged': 'badge-flagged',
    'Reviewed': 'badge-reviewed',
    'SOS': 'badge-critical'
  };
  const icons = {
    'Critical': '🔴', 'Risk': '🟡', 'Normal': '🟢',
    'Pending': '⏳', 'Flagged': '🚩', 'Reviewed': '✅', 'SOS': '🚨'
  };
  return `<span class="badge ${map[status] || 'badge-normal'}">${icons[status] || ''} ${status}</span>`;
}

function getReportTypeLabel(type) {
  const map = {
    blood_test: '🩸 Blood Test',
    ecg: '💓 ECG',
    xray: '🦴 X-Ray',
    mri: '🧠 MRI',
    urine: '🧪 Urine Test',
    ct_scan: '🔬 CT Scan',
    other: '📄 Report'
  };
  return map[type] || '📄 Report';
}

function initSidebar(activeId) {
  const user = getUser();
  if (!user) return;

  const avatarEl = document.getElementById('sidebarAvatar');
  const nameEl = document.getElementById('sidebarName');
  const roleEl = document.getElementById('sidebarRole');

  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;

  if (activeId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const active = document.getElementById(activeId);
    if (active) active.classList.add('active');
  }
}
