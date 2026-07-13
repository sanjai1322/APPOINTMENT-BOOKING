/* ==========================================================================
   MedSchedule Pro — search.js
   Search by patient/doctor name, plus single-date and date-range filters.
   Pure filtering logic lives in applyFilters(); everything below it just
   keeps AppState in sync with the filter bar and triggers a re-render.
   ========================================================================== */

const searchInputEl = document.getElementById('searchInput');
const filterDateEl = document.getElementById('filterDate');
const filterDateFromEl = document.getElementById('filterDateFrom');
const filterDateToEl = document.getElementById('filterDateTo');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

/**
 * Pure filter function — no DOM, no state mutation. Easy to reason about
 * and reuse for both the calendar and the appointment list.
 * @param {Array<Object>} appointments
 * @param {{searchTerm:string, date:string, dateFrom:string, dateTo:string}} filters
 * @returns {Array<Object>}
 */
function applyFilters(appointments, { searchTerm, date, dateFrom, dateTo }) {
  return appointments.filter((appointment) => {
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      const matchesPatient = appointment.patientName.toLowerCase().includes(term);
      const matchesDoctor = appointment.doctorName.toLowerCase().includes(term);
      if (!matchesPatient && !matchesDoctor) return false;
    }
    if (date && appointment.appointmentDate !== date) return false;
    if (dateFrom && appointment.appointmentDate < dateFrom) return false;
    if (dateTo && appointment.appointmentDate > dateTo) return false;
    return true;
  });
}

let searchDebounceTimer = null;
searchInputEl.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    AppState.searchTerm = searchInputEl.value;
    refreshApp();
  }, 180);
});

// A single date and a date range describe overlapping intents, so picking
// one clears the other to avoid a filter combination that silently hides everything.
filterDateEl.addEventListener('change', () => {
  AppState.filterDate = filterDateEl.value;
  if (AppState.filterDate) {
    filterDateFromEl.value = '';
    filterDateToEl.value = '';
    AppState.filterDateFrom = '';
    AppState.filterDateTo = '';
  }
  refreshApp();
});

filterDateFromEl.addEventListener('change', () => {
  AppState.filterDateFrom = filterDateFromEl.value;
  if (AppState.filterDateFrom) {
    filterDateEl.value = '';
    AppState.filterDate = '';
  }
  refreshApp();
});

filterDateToEl.addEventListener('change', () => {
  AppState.filterDateTo = filterDateToEl.value;
  if (AppState.filterDateTo) {
    filterDateEl.value = '';
    AppState.filterDate = '';
  }
  refreshApp();
});

clearFiltersBtn.addEventListener('click', () => {
  searchInputEl.value = '';
  filterDateEl.value = '';
  filterDateFromEl.value = '';
  filterDateToEl.value = '';
  AppState.searchTerm = '';
  AppState.filterDate = '';
  AppState.filterDateFrom = '';
  AppState.filterDateTo = '';
  refreshApp();
});