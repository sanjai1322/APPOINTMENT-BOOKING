/* ==========================================================================
   MedSchedule — calendar.js
   Builds the monthly calendar grid from scratch (no plugin/library) and
   renders appointment chips inside each day cell.
   ========================================================================== */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MAX_CHIPS_PER_DAY = 3;

const calendarGridEl = document.getElementById('calendarGrid');
const currentMonthLabelEl = document.getElementById('currentMonthLabel');

function pad2(value) {
  return String(value).padStart(2, '0');
}

/** Build a 'YYYY-MM-DD' key from a zero-indexed month. */
function toDateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/**
 * Render the full month grid (always 6 rows so the layout never jumps
 * between months), including trailing/leading days from adjacent months.
 * @param {number} year
 * @param {number} monthIndex zero-indexed (0 = January)
 * @param {Array<Object>} appointmentsForMonth appointments already scoped to this month
 */
function renderCalendar(year, monthIndex, appointmentsForMonth) {
  currentMonthLabelEl.textContent = `${MONTH_NAMES[monthIndex]} ${year}`;
  calendarGridEl.innerHTML = '';

  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();
  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  // Group this month's appointments by date for fast lookup per cell.
  const appointmentsByDate = {};
  appointmentsForMonth.forEach((appointment) => {
    if (!appointmentsByDate[appointment.appointmentDate]) {
      appointmentsByDate[appointment.appointmentDate] = [];
    }
    appointmentsByDate[appointment.appointmentDate].push(appointment);
  });
  Object.values(appointmentsByDate).forEach((list) =>
    list.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
  );

  const fragment = document.createDocumentFragment();

  for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
    const dayOffset = cellIndex - startWeekday + 1;
    let cellYear = year;
    let cellMonth = monthIndex;
    let cellDay;
    let isOutside = false;

    if (dayOffset < 1) {
      cellDay = daysInPrevMonth + dayOffset;
      cellMonth = monthIndex - 1;
      isOutside = true;
    } else if (dayOffset > daysInMonth) {
      cellDay = dayOffset - daysInMonth;
      cellMonth = monthIndex + 1;
      isOutside = true;
    } else {
      cellDay = dayOffset;
    }
    if (cellMonth < 0) { cellMonth = 11; cellYear = year - 1; }
    if (cellMonth > 11) { cellMonth = 0; cellYear = year + 1; }

    const dateKey = toDateKey(cellYear, cellMonth, cellDay);
    const isToday = dateKey === todayKey;
    const dayAppointments = appointmentsByDate[dateKey] || [];

    fragment.appendChild(buildDayCell({ dateKey, cellDay, isOutside, isToday, dayAppointments }));
  }

  calendarGridEl.appendChild(fragment);
}

function buildDayCell({ dateKey, cellDay, isOutside, isToday, dayAppointments }) {
  const cell = document.createElement('div');
  cell.className = 'day-cell' +
    (isOutside ? ' is-outside' : ' is-clickable') +
    (isToday ? ' is-today' : '');
  cell.setAttribute('role', 'gridcell');
  cell.dataset.date = dateKey;

  const dayNumberEl = document.createElement('span');
  dayNumberEl.className = 'day-number';
  dayNumberEl.textContent = cellDay;
  cell.appendChild(dayNumberEl);

  if (isToday) {
    const badge = document.createElement('span');
    badge.className = 'today-badge';
    badge.textContent = 'Today';
    cell.appendChild(badge);
  }

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'day-appointments';

  const visibleAppointments = dayAppointments.slice(0, MAX_CHIPS_PER_DAY);
  visibleAppointments.forEach((appointment) => chipsWrap.appendChild(createAppointmentChip(appointment)));

  if (dayAppointments.length > MAX_CHIPS_PER_DAY) {
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'day-more-btn';
    moreBtn.textContent = `+${dayAppointments.length - MAX_CHIPS_PER_DAY} more`;
    moreBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openDayDetail(dateKey, dayAppointments);
    });
    chipsWrap.appendChild(moreBtn);
  }

  cell.appendChild(chipsWrap);

  // Days without an outside-month flag are interactive: click an empty day
  // to book, click a populated day to see the full list for that date.
  if (!isOutside) {
    cell.tabIndex = 0;
    cell.addEventListener('click', () => {
      if (dayAppointments.length > 0) {
        openDayDetail(dateKey, dayAppointments);
      } else {
        openCreateModal(dateKey);
      }
    });
    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cell.click();
      }
    });
  }

  return cell;
}

function createAppointmentChip(appointment) {
  const chip = document.createElement('div');
  chip.className = 'appointment-chip';
  chip.style.setProperty('--chip-color', getSpecialtyColor(appointment.specialty));
  chip.innerHTML = `
    <span class="chip-time">${formatTimeDisplay(appointment.appointmentTime)}</span>
    <span class="chip-patient">${escapeHtml(appointment.patientName)}</span>
    <span class="chip-doctor">${escapeHtml(appointment.doctorName)}</span>
  `;
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    openEditAppointment(appointment.id);
  });
  return chip;
}

/* ==========================================================================
   Day-detail popover — shown when a day has more appointments than the
   cell can display, or when tapping a day cell that already has bookings
   ========================================================================== */

const dayDetailOverlay = document.getElementById('dayDetailOverlay');
const dayDetailList = document.getElementById('dayDetailList');
const dayDetailTitle = document.getElementById('dayDetailTitle');
const closeDayDetailBtn = document.getElementById('closeDayDetailBtn');

function openDayDetail(dateKey, appointments) {
  if (typeof closeAppointmentModal === "function") {
    closeAppointmentModal();
}

if (typeof closeConfirmDialog === "function") {
    closeConfirmDialog();
}
  dayDetailTitle.textContent = formatDateDisplay(dateKey);
  dayDetailList.innerHTML = '';

  appointments.forEach((appointment) => {
    const item = document.createElement('li');
    item.className = 'day-detail-item';
    item.style.setProperty('--chip-color', getSpecialtyColor(appointment.specialty));
    item.innerHTML = `
      <div class="day-detail-time">${formatTimeDisplay(appointment.appointmentTime)}</div>
      <div class="day-detail-info">
        <p class="day-detail-patient">${escapeHtml(appointment.patientName)}</p>
        <p class="day-detail-meta">${escapeHtml(appointment.doctorName)} · ${escapeHtml(appointment.specialty)}</p>
      </div>
      <div class="day-detail-actions">
        <button type="button" class="icon-btn" data-action="edit" aria-label="Edit appointment for ${escapeHtml(appointment.patientName)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button type="button" class="icon-btn icon-btn-danger" data-action="delete" aria-label="Delete appointment for ${escapeHtml(appointment.patientName)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;
    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
      closeDayDetail();
      openEditAppointment(appointment.id);
    });
    item.querySelector('[data-action="delete"]').addEventListener('click', () => {
      closeDayDetail();
      requestDeleteAppointment(appointment.id);
    });
    dayDetailList.appendChild(item);
  });

  dayDetailOverlay.hidden = false;
}

function closeDayDetail() {
  dayDetailOverlay.hidden = true;
}

closeDayDetailBtn.addEventListener('click', closeDayDetail);
dayDetailOverlay.addEventListener('click', (event) => {
  if (event.target === dayDetailOverlay) closeDayDetail();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dayDetailOverlay.hidden) closeDayDetail();
});