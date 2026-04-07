import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, MapPin, X } from 'lucide-react';
import './CrewCalendar.css';
import { loadSettings, SETTINGS_STORAGE_KEY } from '../Settings/settingsStorage';
import {
  CREWS_STORAGE_KEY,
  TICKETS_STORAGE_KEY,
  isTicketClosed,
  isTicketScheduled,
  loadCrews,
  loadTickets,
  saveTickets,
} from '../WorkTickets/ticketUtils';
const ACTIVE_WORKER_STORAGE_KEY = 'tsos-work-ticket-active-worker-v1';

/* ── Helpers ── */
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getFirstOfMonth(d) {
  const date = new Date(d);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function dayNameLong(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isToday(date) {
  const now = new Date();
  return formatDateISO(date) === formatDateISO(now);
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function loadActiveWorkerId() {
  try {
    return localStorage.getItem(ACTIVE_WORKER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toEpoch(value) {
  const stamp = new Date(value).getTime();
  return Number.isNaN(stamp) ? null : stamp;
}

function minutesBetween(startValue, endValue) {
  const start = toEpoch(startValue);
  const end = typeof endValue === 'number' ? endValue : toEpoch(endValue);
  if (start === null || end === null) return 0;
  return Math.max(0, (end - start) / 60000);
}

function getTimeEntries(ticket) {
  return Array.isArray(ticket?.timeEntries) ? ticket.timeEntries : [];
}

function getActiveTimeEntry(ticket) {
  const entries = getTimeEntries(ticket);
  const activeById = entries.find(
    (entry) => entry?.id === ticket?.activeTimeEntryId && !entry?.endAt,
  );
  if (activeById) return activeById;
  return entries.find((entry) => !entry?.endAt) || null;
}

function isClockedIn(ticket) {
  return Boolean(getActiveTimeEntry(ticket));
}

function isOnLunch(ticket) {
  return Boolean(ticket?.activeLunchStartAt && isClockedIn(ticket));
}

function formatDuration(minutes) {
  const wholeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(wholeMinutes / 60);
  const mins = wholeMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function formatClockTime(dateISO) {
  if (!dateISO) return '--';
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function endLunchOnTicket(ticket, nowISO) {
  if (!isOnLunch(ticket)) return ticket;
  const activeEntry = getActiveTimeEntry(ticket);
  if (!activeEntry) return { ...ticket, activeLunchStartAt: null };
  const lunchStartAt = ticket.activeLunchStartAt;
  const lunchMinutes = minutesBetween(lunchStartAt, nowISO);

  return {
    ...ticket,
    activeLunchStartAt: null,
    timeEntries: getTimeEntries(ticket).map((entry) => {
      if (entry.id !== activeEntry.id) return entry;
      const breaks = Array.isArray(entry.breaks) ? entry.breaks : [];
      return {
        ...entry,
        lunchMinutes: Math.max(0, Number(entry.lunchMinutes || 0)) + lunchMinutes,
        breaks: [...breaks, { startAt: lunchStartAt, endAt: nowISO }],
      };
    }),
  };
}

function clockInTicket(ticket, nowISO, worker) {
  if (isClockedIn(ticket)) return ticket;
  const entry = {
    id: uid('time'),
    startAt: nowISO,
    endAt: null,
    workerId: worker?.id || '',
    workerName: worker?.name || worker?.email || 'Unknown Worker',
    lunchMinutes: 0,
    breaks: [],
  };
  return {
    ...ticket,
    activeTimeEntryId: entry.id,
    activeLunchStartAt: null,
    timeEntries: [...getTimeEntries(ticket), entry],
  };
}

function clockOutTicket(ticket, nowISO) {
  if (!isClockedIn(ticket)) return ticket;
  const normalized = endLunchOnTicket(ticket, nowISO);
  const activeEntry = getActiveTimeEntry(normalized);
  if (!activeEntry) {
    return { ...normalized, activeTimeEntryId: null, activeLunchStartAt: null };
  }
  return {
    ...normalized,
    activeTimeEntryId: null,
    activeLunchStartAt: null,
    timeEntries: getTimeEntries(normalized).map((entry) => (
      entry.id === activeEntry.id ? { ...entry, endAt: nowISO } : entry
    )),
  };
}

function addAutoLunchOnTicket(ticket, nowISO, minutes = 30) {
  if (!isClockedIn(ticket)) return ticket;
  const normalized = endLunchOnTicket(ticket, nowISO);
  const activeEntry = getActiveTimeEntry(normalized);
  if (!activeEntry) return normalized;
  return {
    ...normalized,
    timeEntries: getTimeEntries(normalized).map((entry) => {
      if (entry.id !== activeEntry.id) return entry;
      const breaks = Array.isArray(entry.breaks) ? entry.breaks : [];
      return {
        ...entry,
        lunchMinutes: Math.max(0, Number(entry.lunchMinutes || 0)) + minutes,
        breaks: [...breaks, { startAt: nowISO, endAt: nowISO, autoMinutes: minutes }],
      };
    }),
  };
}

function getTicketWorkedMinutes(ticket, nowEpochMs) {
  const activeEntry = getActiveTimeEntry(ticket);
  return getTimeEntries(ticket).reduce((sum, entry) => {
    const start = toEpoch(entry?.startAt);
    if (start === null) return sum;
    const isActiveEntry = activeEntry?.id === entry?.id && !entry?.endAt;
    const end = entry?.endAt ? toEpoch(entry.endAt) : (isActiveEntry ? nowEpochMs : null);
    if (end === null) return sum;

    let lunchMinutes = Math.max(0, Number(entry?.lunchMinutes || 0));
    if (isActiveEntry && ticket?.activeLunchStartAt) {
      lunchMinutes += minutesBetween(ticket.activeLunchStartAt, nowEpochMs);
    }
    return sum + Math.max(0, ((end - start) / 60000) - lunchMinutes);
  }, 0);
}

function getCurrentShiftWorkedMinutes(ticket, nowEpochMs) {
  const activeEntry = getActiveTimeEntry(ticket);
  if (!activeEntry) return 0;
  const start = toEpoch(activeEntry.startAt);
  if (start === null) return 0;
  let lunchMinutes = Math.max(0, Number(activeEntry.lunchMinutes || 0));
  if (ticket?.activeLunchStartAt) {
    lunchMinutes += minutesBetween(ticket.activeLunchStartAt, nowEpochMs);
  }
  return Math.max(0, ((nowEpochMs - start) / 60000) - lunchMinutes);
}

/* ── Main Component ── */
function CrewCalendar() {
  const [tickets, setTickets] = useState(loadTickets);
  const [crews, setCrews] = useState(loadCrews);
  const [settingsSnapshot, setSettingsSnapshot] = useState(loadSettings);
  const [activeWorkerId, setActiveWorkerId] = useState(loadActiveWorkerId);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState('week'); // 'day' | 'week' | 'month'
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [dragTicketId, setDragTicketId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState({});

  useEffect(() => {
    if (!selectedTicket?.id) return;
    const fresh = tickets.find((t) => t.id === selectedTicket.id);
    if (!fresh) {
      setSelectedTicket(null);
      return;
    }
    if (fresh !== selectedTicket) setSelectedTicket(fresh);
  }, [tickets, selectedTicket]);

  // Sync tickets to localStorage
  useEffect(() => {
    saveTickets(tickets);
  }, [tickets]);

  // Listen for ticket/crew updates
  useEffect(() => {
    function onStorage(e) {
      if (e.key === TICKETS_STORAGE_KEY) {
        setTickets(loadTickets());
      }
      if (e.key === CREWS_STORAGE_KEY) {
        setCrews(loadCrews());
      }
    }

    function onLocalTicketUpdate() {
      setTickets(loadTickets());
    }

    function onLocalCrewUpdate() {
      setCrews(loadCrews());
    }

    function onSettingsUpdate() {
      setSettingsSnapshot(loadSettings());
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('work-tickets-updated', onLocalTicketUpdate);
    window.addEventListener('work-crews-updated', onLocalCrewUpdate);
    window.addEventListener('crm-settings-updated', onSettingsUpdate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('work-tickets-updated', onLocalTicketUpdate);
      window.removeEventListener('work-crews-updated', onLocalCrewUpdate);
      window.removeEventListener('crm-settings-updated', onSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    function onSettingsStorage(event) {
      if (!event?.key || event.key === SETTINGS_STORAGE_KEY) {
        setSettingsSnapshot(loadSettings());
      }
    }

    window.addEventListener('storage', onSettingsStorage);
    return () => window.removeEventListener('storage', onSettingsStorage);
  }, []);

  useEffect(() => {
    const hasActiveTimers = tickets.some((ticket) => isClockedIn(ticket));
    if (!hasActiveTimers) return undefined;
    const timer = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [tickets]);

  const activeMembers = useMemo(() => {
    const members = Array.isArray(settingsSnapshot?.members) ? settingsSnapshot.members : [];
    return members.filter((member) => String(member?.status || '').toLowerCase() !== 'disabled');
  }, [settingsSnapshot]);

  useEffect(() => {
    if (activeMembers.length === 0) {
      if (activeWorkerId) setActiveWorkerId('');
      return;
    }
    const exists = activeMembers.some((member) => member.id === activeWorkerId);
    if (!exists) setActiveWorkerId(activeMembers[0].id);
  }, [activeMembers, activeWorkerId]);

  useEffect(() => {
    try {
      if (activeWorkerId) {
        localStorage.setItem(ACTIVE_WORKER_STORAGE_KEY, activeWorkerId);
      } else {
        localStorage.removeItem(ACTIVE_WORKER_STORAGE_KEY);
      }
    } catch {
      // best effort persistence
    }
  }, [activeWorkerId]);

  const activeWorker = useMemo(
    () => activeMembers.find((member) => member.id === activeWorkerId) || null,
    [activeMembers, activeWorkerId],
  );

  /* ── Compute visible days based on view ── */
  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [new Date(currentDate)];
    }
    if (viewMode === 'week') {
      const monday = getMonday(currentDate);
      return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
    }
    // month — full calendar grid (Mon–Fri rows for the whole month)
    const first = getFirstOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      if (!isWeekend(date)) {
        days.push(date);
      }
    }
    return days;
  }, [viewMode, currentDate]);

  /* ── For monthly view: group days into weeks (Mon–Fri) ── */
  const monthWeeks = useMemo(() => {
    if (viewMode !== 'month') return [];
    const weeks = [];
    let currentWeek = [];
    visibleDays.forEach((day) => {
      const dow = day.getDay(); // 1=Mon ... 5=Fri
      if (currentWeek.length > 0) {
        const lastDow = currentWeek[currentWeek.length - 1].getDay();
        if (dow <= lastDow) {
          // New week started
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [viewMode, visibleDays]);

  // Unscheduled tickets grouped by property
  const unscheduledByProperty = useMemo(() => {
    const unscheduled = tickets.filter((t) => !isTicketClosed(t) && !isTicketScheduled(t));
    const groups = {};
    unscheduled.forEach((t) => {
      const key = t.propertyName || 'Unknown Property';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => {
        if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName);
        return a.sequenceNumber - b.sequenceNumber;
      }),
    );
    return groups;
  }, [tickets]);

  // Scheduled tickets indexed by crewId + dateISO
  const scheduledMap = useMemo(() => {
    const map = {};
    tickets
      .filter((t) => !isTicketClosed(t) && isTicketScheduled(t) && t.crewId && t.scheduledDate)
      .forEach((t) => {
        const key = `${t.crewId}::${t.scheduledDate}`;
        if (!map[key]) map[key] = [];
        map[key].push(t);
      });
    return map;
  }, [tickets]);

  /* ── Drag & Drop ── */
  function onDragStart(e, ticketId) {
    setDragTicketId(ticketId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDropOnCell(e, crewId, dateISO) {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain') || dragTicketId;
    if (!ticketId) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, crewId, scheduledDate: dateISO, status: 'scheduled', updatedAt: new Date().toISOString() }
          : t,
      ),
    );
    setDragTicketId(null);
  }

  function onDropOnSidebar(e) {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain') || dragTicketId;
    if (!ticketId) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, crewId: null, scheduledDate: null, status: 'unscheduled', updatedAt: new Date().toISOString() }
          : t,
      ),
    );
    setDragTicketId(null);
  }

  function updateTicketById(ticketId, updater) {
    const nowISO = new Date().toISOString();
    setTickets((prev) =>
      prev.map((ticket) => (
        ticket.id === ticketId
          ? { ...updater(ticket), updatedAt: nowISO }
          : ticket
      )),
    );
  }

  function handleClockInFromSchedule(ticketId) {
    if (!activeWorker) {
      alert('Select an active worker before clocking in.');
      return;
    }
    updateTicketById(ticketId, (ticket) => {
      if (isTicketClosed(ticket)) return ticket;
      const nowISO = new Date().toISOString();
      const started = clockInTicket(ticket, nowISO, activeWorker);
      if (isTicketScheduled(started)) return started;
      return {
        ...started,
        status: started.crewId ? 'scheduled' : (started.status || 'unscheduled'),
        scheduledDate: started.scheduledDate || formatDateISO(new Date()),
      };
    });
  }

  function handleClockOutFromSchedule(ticketId) {
    updateTicketById(ticketId, (ticket) => clockOutTicket(ticket, new Date().toISOString()));
  }

  function handleLunchFromSchedule(ticketId) {
    updateTicketById(ticketId, (ticket) => addAutoLunchOnTicket(ticket, new Date().toISOString(), 30));
  }

  /* ── Ticket Detail Modal ── */
  function updateTicketField(ticketId, field, value) {
    const todayISO = formatDateISO(currentDate);

    function normalizeTicket(ticket, nextField, nextValue) {
      const next = { ...ticket, [nextField]: nextValue, updatedAt: new Date().toISOString() };

      if (nextField === 'status') {
        if (nextValue === 'completed' || nextValue === 'closed') {
          return clockOutTicket(next, new Date().toISOString());
        }
        if (nextValue === 'unscheduled') {
          next.crewId = null;
          next.scheduledDate = null;
        } else if (nextValue === 'scheduled') {
          // Keep status and assignment aligned: no crew/date means unscheduled.
          if (!next.crewId || !next.scheduledDate) next.status = 'unscheduled';
        }
      }

      if (nextField === 'crewId') {
        if (!nextValue) {
          next.crewId = null;
          next.scheduledDate = null;
          if (!isTicketClosed(next)) next.status = 'unscheduled';
        } else {
          if (!next.scheduledDate) next.scheduledDate = todayISO;
          if (!isTicketClosed(next) && next.status === 'unscheduled') next.status = 'scheduled';
        }
      }

      if (nextField === 'scheduledDate') {
        if (!nextValue) {
          next.scheduledDate = null;
          next.crewId = null;
          if (!isTicketClosed(next)) next.status = 'unscheduled';
        } else if (next.crewId && !isTicketClosed(next) && next.status === 'unscheduled') {
          next.status = 'scheduled';
        }
      }

      return next;
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? normalizeTicket(t, field, value) : t,
      ),
    );
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) => normalizeTicket(prev, field, value));
    }
  }

  /* ── Navigation ── */
  function navigatePrev() {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, -1));
    else if (viewMode === 'week') setCurrentDate((d) => addDays(d, -7));
    else setCurrentDate((d) => addMonths(d, -1));
  }

  function navigateNext() {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => addDays(d, 7));
    else setCurrentDate((d) => addMonths(d, 1));
  }

  function goToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setCurrentDate(now);
  }

  function toggleSidebarGroup(propertyName) {
    setSidebarCollapsed((prev) => ({ ...prev, [propertyName]: !prev[propertyName] }));
  }

  /* ── Header label ── */
  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      return formatDateFull(currentDate);
    }
    if (viewMode === 'week') {
      const monday = getMonday(currentDate);
      const friday = addDays(monday, 4);
      return `Week of ${formatDateShort(monday)} – ${formatDateShort(friday)}`;
    }
    return formatMonthYear(currentDate);
  }, [viewMode, currentDate]);

  const totalUnscheduled = tickets.filter((t) => !isTicketClosed(t) && !isTicketScheduled(t)).length;
  const totalScheduled = tickets.filter((t) => !isTicketClosed(t) && isTicketScheduled(t)).length;
  const totalClockedIn = tickets.filter((t) => isClockedIn(t)).length;
  const selectedTicketActiveEntry = selectedTicket ? getActiveTimeEntry(selectedTicket) : null;
  const selectedTicketWorkedMinutes = selectedTicket ? getTicketWorkedMinutes(selectedTicket, clockTick) : 0;
  const selectedTicketShiftMinutes = selectedTicket
    ? getCurrentShiftWorkedMinutes(selectedTicket, clockTick)
    : 0;
  const selectedWorkerLabel = selectedTicketActiveEntry?.workerName || '';
  const selectedTicketClockedIn = selectedTicket ? isClockedIn(selectedTicket) : false;

  /* ── Render helpers ── */

  // Shared: ticket card for calendar cells
  function renderScheduledCard(ticket, crew) {
    return (
      <div
        key={ticket.id}
        className="cc-scheduled-card"
        style={{ borderLeftColor: crew ? crew.color : '#4A90D9' }}
        draggable
        onDragStart={(e) => onDragStart(e, ticket.id)}
        onClick={() => setSelectedTicket(ticket)}
      >
        <div className="cc-sched-title">{ticket.scopeOfWork} #{ticket.sequenceNumber}</div>
        <div className="cc-sched-property">{ticket.propertyName}</div>
        <div className="cc-sched-hours">{Number(ticket.estimatedHours || 0).toFixed(1)}h</div>
      </div>
    );
  }

  // Day cell for weekly/daily table layout
  function renderDayCell(crew, day) {
    const dateISO = formatDateISO(day);
    const cellKey = `${crew.id}::${dateISO}`;
    const cellTickets = scheduledMap[cellKey] || [];
    return (
      <td
        key={dateISO}
        className={`cc-day-cell ${isToday(day) ? 'cc-today' : ''}`}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnCell(e, crew.id, dateISO)}
      >
        {cellTickets.map((ticket) => renderScheduledCard(ticket, crew))}
      </td>
    );
  }

  /* ── DAILY VIEW ── */
  function renderDayView() {
    const day = visibleDays[0];
    return (
      <table className="cc-calendar cc-view-day">
        <thead>
          <tr>
            <th className="cc-crew-col">Crew</th>
            <th className="cc-day-col cc-day-col-single">
              <div className="cc-day-name">{dayNameLong(day)}</div>
              <div className="cc-day-date">{formatDateShort(day)}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {crews.map((crew) => (
            <tr key={crew.id}>
              <td className="cc-crew-cell">
                <div className="cc-crew-dot" style={{ background: crew.color }} />
                <span>{crew.name}</span>
              </td>
              {renderDayCell(crew, day)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* ── WEEKLY VIEW ── */
  function renderWeekView() {
    return (
      <table className="cc-calendar cc-view-week">
        <thead>
          <tr>
            <th className="cc-crew-col">Crew</th>
            {visibleDays.map((day) => (
              <th key={formatDateISO(day)} className={`cc-day-col ${isToday(day) ? 'cc-today-header' : ''}`}>
                <div className="cc-day-name">{dayName(day)}</div>
                <div className="cc-day-date">{formatDateShort(day)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map((crew) => (
            <tr key={crew.id}>
              <td className="cc-crew-cell">
                <div className="cc-crew-dot" style={{ background: crew.color }} />
                <span>{crew.name}</span>
              </td>
              {visibleDays.map((day) => renderDayCell(crew, day))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /* ── MONTHLY VIEW ── */
  function renderMonthView() {
    // Column headers Mon–Fri
    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    return (
      <div className="cc-month-grid">
        {/* Header row */}
        <div className="cc-month-header-row">
          {dayHeaders.map((name) => (
            <div key={name} className="cc-month-header-cell">{name}</div>
          ))}
        </div>

        {/* Week rows */}
        {monthWeeks.map((week, weekIdx) => (
          <div key={weekIdx} className="cc-month-week-row">
            {/* Pad leading empty cells if week doesn't start on Monday */}
            {Array.from({ length: week[0].getDay() - 1 }, (_, i) => (
              <div key={`empty-${i}`} className="cc-month-day-cell cc-month-empty" />
            ))}

            {week.map((day) => {
              const dateISO = formatDateISO(day);
              // Collect all tickets across all crews for this date
              const dayTickets = [];
              crews.forEach((crew) => {
                const key = `${crew.id}::${dateISO}`;
                const ct = scheduledMap[key] || [];
                ct.forEach((t) => dayTickets.push({ ticket: t, crew }));
              });

              return (
                <div
                  key={dateISO}
                  className={`cc-month-day-cell ${isToday(day) ? 'cc-today' : ''}`}
                  onDragOver={onDragOver}
                  onDrop={(e) => {
                    // Keep existing crew assignment when moving a scheduled ticket in month view.
                    const ticketId = e.dataTransfer.getData('text/plain') || dragTicketId;
                    const existing = tickets.find((t) => t.id === ticketId);
                    const crewId = existing?.crewId || (crews.length > 0 ? crews[0].id : null);
                    onDropOnCell(e, crewId, dateISO);
                  }}
                >
                  <div className="cc-month-day-number">{day.getDate()}</div>
                  <div className="cc-month-day-tickets">
                    {dayTickets.slice(0, 3).map(({ ticket, crew }) => (
                      <div
                        key={ticket.id}
                        className="cc-month-ticket-chip"
                        style={{ borderLeftColor: crew.color }}
                        draggable
                        onDragStart={(e) => onDragStart(e, ticket.id)}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        {ticket.scopeOfWork} #{ticket.sequenceNumber}
                      </div>
                    ))}
                    {dayTickets.length > 3 && (
                      <div className="cc-month-more">+{dayTickets.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pad trailing empty cells if week doesn't end on Friday */}
            {Array.from({ length: 5 - (week[week.length - 1].getDay()) }, (_, i) => (
              <div key={`trail-${i}`} className="cc-month-day-cell cc-month-empty" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="crew-calendar-shell">
      {/* ── Header ── */}
      <header className="cc-header">
        <div className="cc-header-left">
          <Calendar size={18} className="cc-header-icon" />
          <h1>Crew Schedule</h1>
        </div>
        <div className="cc-header-center">
          {/* View toggle */}
          <div className="cc-view-toggle">
            <button
              type="button"
              className={`cc-view-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => setViewMode('day')}
            >Day</button>
            <button
              type="button"
              className={`cc-view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >Week</button>
            <button
              type="button"
              className={`cc-view-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >Month</button>
          </div>

          {/* Navigation */}
          <button type="button" className="cc-nav-btn" onClick={navigatePrev}>
            <ChevronLeft size={16} />
          </button>
          <span className="cc-week-label">
            {headerLabel}
          </span>
          <button type="button" className="cc-nav-btn" onClick={navigateNext}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="cc-today-btn" onClick={goToday}>Today</button>
        </div>
        <div className="cc-header-right">
          <span className="cc-stat">{totalUnscheduled} unscheduled</span>
          <span className="cc-stat">{totalScheduled} scheduled</span>
          <span className="cc-stat">{totalClockedIn} clocked in</span>
          <label className="cc-worker-picker">
            <span>Active Worker</span>
            <select
              value={activeWorkerId}
              onChange={(e) => setActiveWorkerId(e.target.value)}
            >
              {activeMembers.length === 0 ? (
                <option value="">No active members</option>
              ) : (
                activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="cc-layout">
        {/* ── Unscheduled Sidebar ── */}
        <aside
          className="cc-sidebar"
          onDragOver={onDragOver}
          onDrop={onDropOnSidebar}
        >
          <h2 className="cc-sidebar-title">Unscheduled Jobs</h2>

          {Object.keys(unscheduledByProperty).length === 0 && (
            <div className="cc-sidebar-empty">No unscheduled tickets</div>
          )}

          {Object.entries(unscheduledByProperty).map(([propertyName, propertyTickets]) => (
            <div key={propertyName} className="cc-property-group">
              <button
                type="button"
                className="cc-property-header"
                onClick={() => toggleSidebarGroup(propertyName)}
              >
                {sidebarCollapsed[propertyName] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="cc-property-name">{propertyName}</span>
                <span className="cc-property-count">{propertyTickets.length}</span>
              </button>

              {!sidebarCollapsed[propertyName] && (
                <div className="cc-property-tickets">
                  {propertyTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="cc-ticket-card"
                      draggable
                      onDragStart={(e) => onDragStart(e, ticket.id)}
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="cc-ticket-title">
                        {ticket.scopeOfWork} #{ticket.sequenceNumber}
                      </div>
                      <div className="cc-ticket-meta">
                        <Clock size={10} />
                        <span>{Number(ticket.estimatedHours || 0).toFixed(1)}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* ── Calendar Grid ── */}
        <div className="cc-calendar-wrap">
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </div>
      </div>

      {/* ── Ticket Detail Modal ── */}
      {selectedTicket && (
        <div className="cc-modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h3>{selectedTicket.scopeOfWork} #{selectedTicket.sequenceNumber} of {selectedTicket.totalVisits}</h3>
              <button type="button" className="cc-modal-close" onClick={() => setSelectedTicket(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="cc-modal-body">
              <div className="cc-modal-field">
                <label>Property</label>
                <div className="cc-modal-value">
                  <MapPin size={12} />
                  {selectedTicket.propertyName}
                  {selectedTicket.propertyAddress && (
                    <span className="cc-modal-address"> &mdash; {selectedTicket.propertyAddress}</span>
                  )}
                </div>
              </div>

              <div className="cc-modal-field">
                <label>Scope of Work</label>
                <div className="cc-modal-value">{selectedTicket.scopeOfWork}</div>
              </div>

              <div className="cc-modal-field">
                <label>Work Description</label>
                <div className="cc-modal-value cc-modal-desc">{selectedTicket.workDescription}</div>
              </div>

              <div className="cc-modal-row">
                <div className="cc-modal-field">
                  <label>Est. Hours</label>
                  <div className="cc-modal-value">{Number(selectedTicket.estimatedHours || 0).toFixed(1)}</div>
                </div>
                <div className="cc-modal-field">
                  <label>Est. Price</label>
                  <div className="cc-modal-value">
                    ${Number(selectedTicket.estimatedPrice || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="cc-modal-field cc-time-block">
                <label>Time Tracking</label>
                <div className="cc-time-summary">
                  <span className={`cc-time-pill ${selectedTicketClockedIn ? 'in' : 'out'}`}>
                    {selectedTicketClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </span>
                  <span>Actual: {formatDuration(selectedTicketWorkedMinutes)}</span>
                  {selectedWorkerLabel && <span>Worker: {selectedWorkerLabel}</span>}
                  {selectedTicketActiveEntry && (
                    <span>
                      Shift: {formatClockTime(selectedTicketActiveEntry.startAt)} - now ({formatDuration(selectedTicketShiftMinutes)})
                    </span>
                  )}
                </div>
                <div className="cc-time-actions">
                  <button
                    type="button"
                    className="cc-time-btn"
                    onClick={() => (
                      selectedTicketClockedIn
                        ? handleClockOutFromSchedule(selectedTicket.id)
                        : handleClockInFromSchedule(selectedTicket.id)
                    )}
                    disabled={isTicketClosed(selectedTicket) || (!selectedTicketClockedIn && !activeWorker)}
                    title={
                      isTicketClosed(selectedTicket)
                        ? 'Reopen ticket to track time.'
                        : (!selectedTicketClockedIn && !activeWorker)
                          ? 'Select an active worker in header first.'
                          : ''
                    }
                  >
                    {selectedTicketClockedIn ? 'Clock Out' : 'Clock In'}
                  </button>
                  <button
                    type="button"
                    className="cc-time-btn"
                    onClick={() => handleLunchFromSchedule(selectedTicket.id)}
                    disabled={isTicketClosed(selectedTicket) || !selectedTicketClockedIn}
                    title={!selectedTicketClockedIn ? 'Clock in first.' : (isTicketClosed(selectedTicket) ? 'Reopen ticket to track time.' : 'Deducts 30 minutes')}
                  >
                    Lunch +30m
                  </button>
                  {!activeWorker && (
                    <span className="cc-time-hint">No active worker selected in header.</span>
                  )}
                </div>
              </div>

              <div className="cc-modal-row">
                <div className="cc-modal-field">
                  <label>Status</label>
                  <select
                    className="cc-modal-select"
                    value={selectedTicket.status}
                    onChange={(e) => updateTicketField(selectedTicket.id, 'status', e.target.value)}
                  >
                    <option value="unscheduled">Unscheduled</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="cc-modal-field">
                  <label>Crew</label>
                  <select
                    className="cc-modal-select"
                    value={selectedTicket.crewId || ''}
                    onChange={(e) => updateTicketField(selectedTicket.id, 'crewId', e.target.value || null)}
                  >
                    <option value="">-- Unassigned --</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cc-modal-field">
                <label>Notes</label>
                <textarea
                  className="cc-modal-textarea"
                  value={selectedTicket.notes || ''}
                  onChange={(e) => updateTicketField(selectedTicket.id, 'notes', e.target.value)}
                  placeholder="Add notes..."
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrewCalendar;
