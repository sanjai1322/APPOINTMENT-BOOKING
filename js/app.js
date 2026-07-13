/* ==========================================================================
   MedSchedule Pro — app.js
   Application bootstrap: shared state, formatting utilities, toasts,
   view switching, mobile nav, and the central refreshApp() render loop.
   Loaded last, after storage.js / calendar.js / appointments.js /
   modal.js / search.js have defined their functions.
   ========================================================================== */

/* ==========================================================================
   Specialty colour key — drives calendar chips, table pills, and legend
   Vibrant neon-friendly palette for the dark theme
   ========================================================================== */

const SPECIALTY_COLORS = {
  'Cardiology': '#ff6b6b',
  'Dermatology': '#a855f7',
  'Neurology': '#3b82f6',
  'Orthopedics': '#f59e0b',
  'Pediatrics': '#10b981',
  'General Medicine': '#06b6d4',
  'Dentistry': '#14b8a6',
  'ENT': '#f97316'
};
const DEFAULT_SPECIALTY_COLOR = '#8891ab';

function getSpecialtyColor(specialty) {
  return SPECIALTY_COLORS[specialty] || DEFAULT_SPECIALTY_COLOR;
}

/* ==========================================================================
   Formatting utilities
   ========================================================================== */

/** Escape user-entered text before it's dropped into innerHTML. */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === undefined || value === null ? '' : String(value);
  return div.innerHTML;
}

/** '14:30' -> '2:30 PM' */
function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/** '2026-07-11' -> 'Jul 11, 2026' */
function formatDateDisplay(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ==========================================================================
   Shared application state
   ========================================================================== */

const today = new Date();

const AppState = {
  appointments: [],
  filtered: [],
  view: 'calendar',
  calendarYear: today.getFullYear(),
  calendarMonth: today.getMonth(),
  searchTerm: '',
  filterDate: '',
  filterDateFrom: '',
  filterDateTo: ''
};

/* ==========================================================================
   Toast notifications — with icon and slide-in animation
   ========================================================================== */

const toastContainer = document.getElementById('toastContainer');

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 */
function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type || 'info'}`;
  const iconGlyph = type === 'success' ? '✓' : type === 'error' ? '✕' : 'i';
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${iconGlyph}</span><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ==========================================================================
   View switching — Calendar vs. Appointments list
   ========================================================================== */

const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');

function switchView(viewName) {
  AppState.view = viewName;
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === viewName));
  viewPanels.forEach((panel) => panel.classList.toggle('is-active', panel.id === viewName + 'View'));
  closeMobileNav();
}

navItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    switchView(item.dataset.view);
  });
});

/* ==========================================================================
   Mobile navigation drawer
   ========================================================================== */

const sidebarEl = document.getElementById('sidebar');
const sidebarScrim = document.getElementById('sidebarScrim');
const mobileNavToggle = document.getElementById('mobileNavToggle');

function openMobileNav() {
  sidebarEl.classList.add('is-open');
  sidebarScrim.classList.add('is-visible');
  mobileNavToggle.setAttribute('aria-expanded', 'true');
}

function closeMobileNav() {
  sidebarEl.classList.remove('is-open');
  sidebarScrim.classList.remove('is-visible');
  mobileNavToggle.setAttribute('aria-expanded', 'false');
}

mobileNavToggle.addEventListener('click', () => {
  sidebarEl.classList.contains('is-open') ? closeMobileNav() : openMobileNav();
});
sidebarScrim.addEventListener('click', closeMobileNav);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebarEl.classList.contains('is-open')) closeMobileNav();
});

/* ==========================================================================
   Calendar month navigation (wired here so AppState is in scope)
   ========================================================================== */

document.getElementById('prevMonthBtn').addEventListener('click', () => {
  AppState.calendarMonth -= 1;
  if (AppState.calendarMonth < 0) {
    AppState.calendarMonth = 11;
    AppState.calendarYear -= 1;
  }
  refreshApp();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
  AppState.calendarMonth += 1;
  if (AppState.calendarMonth > 11) {
    AppState.calendarMonth = 0;
    AppState.calendarYear += 1;
  }
  refreshApp();
});

document.getElementById('todayBtn').addEventListener('click', () => {
  const now = new Date();
  AppState.calendarYear = now.getFullYear();
  AppState.calendarMonth = now.getMonth();
  refreshApp();
});

/* ==========================================================================
   Specialty legend (sidebar)
   ========================================================================== */

function renderLegend() {
  const legendList = document.getElementById('legendList');
  legendList.innerHTML = '';
  Object.entries(SPECIALTY_COLORS).forEach(([specialtyName, color]) => {
    const item = document.createElement('li');
    item.innerHTML = `<span class="legend-dot" style="--chip-color:${color}"></span>${specialtyName}`;
    legendList.appendChild(item);
  });
}

/* ==========================================================================
   Header subtitle — live appointment count
   ========================================================================== */

function updateHeaderSubtitle() {
  const subtitleEl = document.getElementById('headerSubtitle');
  const count = AppState.filtered.length;
  const monthLabel = `${MONTH_NAMES[AppState.calendarMonth]} ${AppState.calendarYear}`;
  const hasActiveFilters = AppState.searchTerm || AppState.filterDate || AppState.filterDateFrom || AppState.filterDateTo;

  subtitleEl.textContent = hasActiveFilters
    ? `${count} appointment${count === 1 ? '' : 's'} match your filters`
    : `${count} total appointment${count === 1 ? '' : 's'} · viewing ${monthLabel}`;
}

/* ==========================================================================
   Sidebar statistics — total, today, upcoming counts
   ========================================================================== */

function updateSidebarStats() {
  const allAppointments = AppState.appointments;
  const todayNow = new Date();
  const todayKey = toDateKey(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

  const totalCount = allAppointments.length;
  const todayCount = allAppointments.filter(a => a.appointmentDate === todayKey).length;
  const upcomingCount = allAppointments.filter(a => a.appointmentDate > todayKey).length;

  document.getElementById('statTotal').textContent = totalCount;
  document.getElementById('statToday').textContent = todayCount;
  document.getElementById('statUpcoming').textContent = upcomingCount;

  // Animate the numbers on update
  ['statTotal', 'statToday', 'statUpcoming'].forEach(id => {
    const el = document.getElementById(id);
    el.style.animation = 'none';
    requestAnimationFrame(() => {
      el.style.animation = 'stat-pop 0.3s ease';
    });
  });
}

/* ==========================================================================
   Central refresh loop — the single place that reloads from storage,
   re-applies filters, and re-renders every view. Every CRUD action and
   every filter change ends by calling this.
   ========================================================================== */

function refreshApp() {
  AppState.appointments = loadAppointments();
  AppState.filtered = applyFilters(AppState.appointments, {
    searchTerm: AppState.searchTerm,
    date: AppState.filterDate,
    dateFrom: AppState.filterDateFrom,
    dateTo: AppState.filterDateTo
  });

  const monthAppointments = AppState.filtered.filter((appointment) => {
    const [year, month] = appointment.appointmentDate.split('-').map(Number);
    return year === AppState.calendarYear && (month - 1) === AppState.calendarMonth;
  });

  renderCalendar(AppState.calendarYear, AppState.calendarMonth, monthAppointments);
  renderAppointmentsList(AppState.filtered);
  updateHeaderSubtitle();
  updateSidebarStats();
}

/* ==========================================================================
   First-run sample data — seeded once so the UI isn't empty on first load.
   Guarded by a separate flag so it never re-appears after the user deletes
   everything.
   ========================================================================== */

function seedSampleDataIfFirstRun() {
  const alreadySeeded = localStorage.getItem('medschedule.seeded.v2');
  if (alreadySeeded) return;
  localStorage.setItem('medschedule.seeded.v2', 'true');
  if (loadAppointments().length > 0) return;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const dateKey = (day) => `${y}-${pad2(m + 1)}-${pad2(Math.min(Math.max(day, 1), lastDay))}`;

  const sampleAppointments = [
    { patientName: 'Ananya Rao', doctorName: 'Dr. Meera Nair', hospitalName: 'City Care Hospital', specialty: 'Cardiology', appointmentDate: dateKey(now.getDate() + 1), appointmentTime: '09:30', reason: 'Routine ECG follow-up and blood pressure monitoring' },
    { patientName: 'Rahul Verma', doctorName: 'Dr. Arjun Iyer', hospitalName: 'Sunrise Clinic', specialty: 'Orthopedics', appointmentDate: dateKey(now.getDate() + 1), appointmentTime: '11:00', reason: 'Knee pain evaluation and X-ray review' },
    { patientName: 'Priya Sharma', doctorName: 'Dr. Kavya Menon', hospitalName: 'City Care Hospital', specialty: 'Pediatrics', appointmentDate: dateKey(now.getDate()), appointmentTime: '14:00', reason: 'Scheduled vaccination for 6-month checkup' },
    { patientName: 'Sanjay Gupta', doctorName: 'Dr. Meera Nair', hospitalName: 'City Care Hospital', specialty: 'Cardiology', appointmentDate: dateKey(now.getDate() + 4), appointmentTime: '10:00', reason: 'Chest pain consultation and stress test' },
    { patientName: 'Divya Krishnan', doctorName: 'Dr. Farah Ali', hospitalName: 'Lakeview Medical Center', specialty: 'Dermatology', appointmentDate: dateKey(now.getDate() + 7), appointmentTime: '16:30', reason: 'Skin allergy check-up and treatment plan' },
    { patientName: 'Vikram Patel', doctorName: 'Dr. Ravi Kumar', hospitalName: 'Apollo Hospital', specialty: 'Neurology', appointmentDate: dateKey(now.getDate() + 2), appointmentTime: '15:00', reason: 'Migraine frequency assessment and MRI review' },
    { patientName: 'Sneha Reddy', doctorName: 'Dr. Priya Das', hospitalName: 'Sunrise Clinic', specialty: 'Dentistry', appointmentDate: dateKey(now.getDate()), appointmentTime: '10:30', reason: 'Root canal follow-up and crown fitting' }
  ];

  sampleAppointments.forEach((appointment) => createAppointment(appointment));
}

/* ==========================================================================
   Add CSS animation keyframes dynamically
   ========================================================================== */

function addDynamicStyles() {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }

    @keyframes stat-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }

    .table-patient-name {
      font-weight: 600;
      color: var(--color-text);
    }

    .table-date {
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 600;
    }

    .table-time {
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--color-primary);
    }

    .table-today-badge {
      display: inline-block;
      margin-left: 6px;
      background: var(--gradient-accent);
      color: #0a0e1a;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1px 6px;
      border-radius: 100px;
      vertical-align: middle;
    }

    .is-today-row {
      background: rgba(0, 206, 201, 0.03) !important;
    }

    .is-today-row:hover {
      background: rgba(0, 206, 201, 0.06) !important;
    }

    .is-today-card {
      border-color: rgba(0, 206, 201, 0.2) !important;
      background: rgba(0, 206, 201, 0.03) !important;
    }
  `;
  document.head.appendChild(styleSheet);
}

/* ==========================================================================
   Theme Toggling Logic
   ========================================================================== */

const themeToggleBtn = document.getElementById('themeToggleBtn');
const moonIcon = themeToggleBtn?.querySelector('.moon-icon');
const sunIcon = themeToggleBtn?.querySelector('.sun-icon');

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (moonIcon) moonIcon.style.display = 'none';
    if (sunIcon) sunIcon.style.display = 'block';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (moonIcon) moonIcon.style.display = 'block';
    if (sunIcon) sunIcon.style.display = 'none';
  }
  localStorage.setItem('medschedule.theme', theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem('medschedule.theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Default to light
    applyTheme('light');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    });
  }
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */

function initApp() {
  initTheme();
  addDynamicStyles();
  seedSampleDataIfFirstRun();
  renderLegend();
  refreshApp();
}

initApp();