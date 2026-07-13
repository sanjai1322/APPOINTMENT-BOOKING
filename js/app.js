/* ==========================================================================
   MedSchedule — app.js
   Application bootstrap: shared state, formatting utilities, toasts,
   view switching, mobile nav, and the central refreshApp() render loop.
   Loaded last, after storage.js / calendar.js / appointments.js /
   modal.js / search.js have defined their functions.
   ========================================================================== */

/* ==========================================================================
   Specialty colour key — drives calendar chips, table pills, and legend
   ========================================================================== */

const SPECIALTY_COLORS = {
  'Cardiology': '#D64545',
  'Dermatology': '#8B6FD1',
  'Neurology': '#3D7FC7',
  'Orthopedics': '#C6890B',
  'Pediatrics': '#2F9E6E',
  'General Medicine': '#1B6B63',
  'Dentistry': '#2A9AA8',
  'ENT': '#E8734A'
};
const DEFAULT_SPECIALTY_COLOR = '#5C7772';

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
   Toast notifications
   ========================================================================== */

const toastContainer = document.getElementById('toastContainer');

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 */
function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type || 'info'}`;
  const iconGlyph = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${iconGlyph}</span><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
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
}

/* ==========================================================================
   First-run sample data — seeded once so the UI isn't empty on first load.
   Guarded by a separate flag so it never re-appears after the user deletes
   everything.
   ========================================================================== */

function seedSampleDataIfFirstRun() {
  const alreadySeeded = localStorage.getItem('medschedule.seeded.v1');
  if (alreadySeeded) return;
  localStorage.setItem('medschedule.seeded.v1', 'true');
  if (loadAppointments().length > 0) return;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const dateKey = (day) => `${y}-${pad2(m + 1)}-${pad2(Math.min(day, lastDay))}`;

  const sampleAppointments = [
    { patientName: 'Ananya Rao', doctorName: 'Dr. Meera Nair', hospitalName: 'City Care Hospital', specialty: 'Cardiology', appointmentDate: dateKey(now.getDate() + 1), appointmentTime: '09:30', reason: 'Routine ECG follow-up' },
    { patientName: 'Rahul Verma', doctorName: 'Dr. Arjun Iyer', hospitalName: 'Sunrise Clinic', specialty: 'Orthopedics', appointmentDate: dateKey(now.getDate() + 1), appointmentTime: '11:00', reason: 'Knee pain evaluation' },
    { patientName: 'Priya Sharma', doctorName: 'Dr. Kavya Menon', hospitalName: 'City Care Hospital', specialty: 'Pediatrics', appointmentDate: dateKey(now.getDate()), appointmentTime: '14:00', reason: 'Scheduled vaccination' },
    { patientName: 'Sanjay Gupta', doctorName: 'Dr. Meera Nair', hospitalName: 'City Care Hospital', specialty: 'Cardiology', appointmentDate: dateKey(now.getDate() + 4), appointmentTime: '10:00', reason: 'Chest pain consultation' },
    { patientName: 'Divya Krishnan', doctorName: 'Dr. Farah Ali', hospitalName: 'Lakeview Medical Center', specialty: 'Dermatology', appointmentDate: dateKey(now.getDate() + 7), appointmentTime: '16:30', reason: 'Skin allergy check-up' }
  ];

  sampleAppointments.forEach((appointment) => createAppointment(appointment));
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */

function initApp() {
  seedSampleDataIfFirstRun();
  renderLegend();
  refreshApp();
}

initApp();