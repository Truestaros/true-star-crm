import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, MapPin } from 'lucide-react';
import './WorkTicketsPage.css';
import { loadSettings, SETTINGS_STORAGE_KEY } from '../Settings/settingsStorage';
import {
  CREWS_STORAGE_KEY,
  TICKETS_STORAGE_KEY,
  isTicketClosed,
  isTicketOpen,
  isTicketScheduled,
  loadCrews,
  loadTickets,
  saveTickets,
} from './ticketUtils';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'unscheduled', label: 'Unscheduled' },
];
const ACTIVE_WORKER_STORAGE_KEY = 'tsos-work-ticket-active-worker-v1';

function getLifecycleLabel(ticket) {
  return isTicketClosed(ticket) ? 'Closed' : 'Open';
}

function getScheduleLabel(ticket) {
  return isTicketScheduled(ticket) ? 'Scheduled' : 'Unscheduled';
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function formatDate(dateISO) {
  if (!dateISO) return 'Not set';
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeForReopen(ticket) {
  return isTicketScheduled(ticket)
    ? { ...ticket, status: 'scheduled' }
    : { ...ticket, status: 'unscheduled' };
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

function getLastTimeEntry(ticket) {
  const entries = getTimeEntries(ticket);
  return entries.length > 0 ? entries[entries.length - 1] : null;
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

function getTimeStatus(ticket) {
  if (isClockedIn(ticket)) return 'clocked-in';
  return 'clocked-out';
}

function getTimeStatusLabel(ticket) {
  const status = getTimeStatus(ticket);
  if (status === 'clocked-in') return 'Clocked In';
  return 'Clocked Out';
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

function clockOutTicket(ticket, nowISO) {
  if (!isClockedIn(ticket)) return ticket;
  const afterLunch = endLunchOnTicket(ticket, nowISO);
  const activeEntry = getActiveTimeEntry(afterLunch);
  if (!activeEntry) {
    return { ...afterLunch, activeTimeEntryId: null, activeLunchStartAt: null };
  }
  return {
    ...afterLunch,
    activeTimeEntryId: null,
    activeLunchStartAt: null,
    timeEntries: getTimeEntries(afterLunch).map((entry) => (
      entry.id === activeEntry.id
        ? { ...entry, endAt: nowISO }
        : entry
    )),
  };
}

function addAutoLunchOnTicket(ticket, nowISO, lunchMinutesToAdd = 30) {
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
        lunchMinutes: Math.max(0, Number(entry.lunchMinutes || 0)) + lunchMinutesToAdd,
        breaks: [...breaks, { startAt: nowISO, endAt: nowISO, autoMinutes: lunchMinutesToAdd }],
      };
    }),
  };
}

function clockInTicket(ticket, nowISO, worker) {
  if (isClockedIn(ticket)) return ticket;
  const newEntry = {
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
    activeTimeEntryId: newEntry.id,
    activeLunchStartAt: null,
    timeEntries: [...getTimeEntries(ticket), newEntry],
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

    const worked = Math.max(0, ((end - start) / 60000) - lunchMinutes);
    return sum + worked;
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

function WorkTicketsPage() {
  const [tickets, setTickets] = useState(loadTickets);
  const [crews, setCrews] = useState(loadCrews);
  const [settingsSnapshot, setSettingsSnapshot] = useState(loadSettings);
  const [activeWorkerId, setActiveWorkerId] = useState(loadActiveWorkerId);
  const [activeFilter, setActiveFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    function onStorage(event) {
      if (!event.key || event.key === TICKETS_STORAGE_KEY) {
        setTickets(loadTickets());
      }
      if (!event.key || event.key === CREWS_STORAGE_KEY) {
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

  const crewById = useMemo(() => (
    crews.reduce((acc, crew) => {
      acc[crew.id] = crew.name;
      return acc;
    }, {})
  ), [crews]);

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

  const counts = useMemo(() => ({
    open: tickets.filter((ticket) => isTicketOpen(ticket)).length,
    closed: tickets.filter((ticket) => isTicketClosed(ticket)).length,
    scheduled: tickets.filter((ticket) => isTicketOpen(ticket) && isTicketScheduled(ticket)).length,
    unscheduled: tickets.filter((ticket) => isTicketOpen(ticket) && !isTicketScheduled(ticket)).length,
    clockedIn: tickets.filter((ticket) => isClockedIn(ticket)).length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    const search = query.trim().toLowerCase();

    const matchesFilter = (ticket) => {
      if (activeFilter === 'closed') return isTicketClosed(ticket);
      if (activeFilter === 'scheduled') return isTicketOpen(ticket) && isTicketScheduled(ticket);
      if (activeFilter === 'unscheduled') return isTicketOpen(ticket) && !isTicketScheduled(ticket);
      return isTicketOpen(ticket);
    };

    const matchesSearch = (ticket) => {
      if (!search) return true;
      return [
        ticket.scopeOfWork,
        ticket.sectionName,
        ticket.propertyName,
        ticket.propertyAddress,
        ticket.workDescription,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(search));
    };

    return [...tickets]
      .filter((ticket) => matchesFilter(ticket) && matchesSearch(ticket))
      .sort((a, b) => {
        const aClosed = isTicketClosed(a) ? 1 : 0;
        const bClosed = isTicketClosed(b) ? 1 : 0;
        if (aClosed !== bClosed) return aClosed - bClosed;

        const aSched = isTicketScheduled(a) ? 1 : 0;
        const bSched = isTicketScheduled(b) ? 1 : 0;
        if (aSched !== bSched) return bSched - aSched;

        const aDate = a.scheduledDate || '';
        const bDate = b.scheduledDate || '';
        if (aDate !== bDate) return aDate.localeCompare(bDate);

        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
  }, [tickets, activeFilter, query]);

  function updateTicket(ticketId, updater) {
    setTickets((prev) => {
      const next = prev.map((ticket) => (
        ticket.id === ticketId
          ? { ...updater(ticket), updatedAt: new Date().toISOString() }
          : ticket
      ));
      saveTickets(next);
      return next;
    });
  }

  function toggleClosed(ticket) {
    updateTicket(ticket.id, (current) => {
      if (isTicketClosed(current)) return normalizeForReopen(current);
      const nowISO = new Date().toISOString();
      const stopped = clockOutTicket(current, nowISO);
      return { ...stopped, status: 'completed' };
    });
  }

  function toggleScheduled(ticket) {
    updateTicket(ticket.id, (current) => {
      if (isTicketScheduled(current)) {
        return {
          ...current,
          status: 'unscheduled',
          scheduledDate: null,
          crewId: null,
        };
      }
      const fallbackCrewId = current.crewId || crews[0]?.id || null;
      return {
        ...current,
        status: fallbackCrewId ? 'scheduled' : 'unscheduled',
        crewId: fallbackCrewId,
        scheduledDate: current.scheduledDate || new Date().toISOString().slice(0, 10),
      };
    });
  }

  function handleClockIn(ticket) {
    if (!activeWorker) {
      alert('Select an active worker before clocking in.');
      return;
    }
    updateTicket(ticket.id, (current) => {
      if (isTicketClosed(current)) return current;
      const nowISO = new Date().toISOString();
      const started = clockInTicket(current, nowISO, activeWorker);
      if (isTicketScheduled(started)) return started;
      return {
        ...started,
        status: started.crewId ? 'scheduled' : (started.status || 'unscheduled'),
        scheduledDate: started.scheduledDate || new Date().toISOString().slice(0, 10),
      };
    });
  }

  function handleClockOut(ticket) {
    updateTicket(ticket.id, (current) => clockOutTicket(current, new Date().toISOString()));
  }

  function handleLunch(ticket) {
    updateTicket(ticket.id, (current) => addAutoLunchOnTicket(current, new Date().toISOString(), 30));
  }

  return (
    <section className="work-tickets-page">
      <div className="panel-card wt-header-card">
        <div className="wt-title">
          <h2>Work Tickets</h2>
          <p>Filter and manage ticket visibility across open, closed, scheduled, and unscheduled work.</p>
        </div>
        <div className="wt-stats">
          <span><Clock3 size={14} /> {counts.open} open</span>
          <span><CheckCircle2 size={14} /> {counts.closed} closed</span>
          <span><CalendarDays size={14} /> {counts.scheduled} scheduled</span>
          <span><Clock3 size={14} /> {counts.clockedIn} clocked in</span>
        </div>
      </div>

      <div className="panel-card wt-toolbar-card">
        <div className="filter-bar">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`pill-btn ${activeFilter === filter.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label} ({counts[filter.key] || 0})
            </button>
          ))}
        </div>
        <div className="wt-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ticket, property, or scope"
          />
        </div>
        <div className="wt-worker-picker">
          <label htmlFor="wt-active-worker">Active Worker</label>
          <select
            id="wt-active-worker"
            value={activeWorkerId}
            onChange={(event) => setActiveWorkerId(event.target.value)}
          >
            {activeMembers.length === 0 ? (
              <option value="">No active members in Settings</option>
            ) : (
              activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="panel-card wt-list-card">
        <div className="wt-table-header">
          <span>Ticket</span>
          <span>Property</span>
          <span>Schedule</span>
          <span>Status</span>
          <span>Estimate</span>
          <span>Time</span>
          <span>Actions</span>
        </div>

        {filteredTickets.length === 0 && (
          <div className="wt-empty">
            <ClipboardList size={20} />
            <div>
              <strong>No tickets in this view.</strong>
              <p>Approve estimates in V6 Formula Engine to generate work tickets.</p>
            </div>
          </div>
        )}

        {filteredTickets.map((ticket) => {
          const crewName = ticket.crewId ? (crewById[ticket.crewId] || ticket.crewId) : 'Unassigned';
          const activeEntry = getActiveTimeEntry(ticket);
          const lastEntry = getLastTimeEntry(ticket);
          const totalWorkedMinutes = getTicketWorkedMinutes(ticket, clockTick);
          const shiftWorkedMinutes = getCurrentShiftWorkedMinutes(ticket, clockTick);
          const statusClass = getTimeStatus(ticket);
          const workerLabel = activeEntry?.workerName || lastEntry?.workerName || '';
          return (
            <div key={ticket.id} className="wt-table-row">
              <div className="wt-ticket-cell">
                <strong>{ticket.scopeOfWork || ticket.sectionName || 'Untitled Work'}</strong>
                <span>#{ticket.sequenceNumber || 1} of {ticket.totalVisits || 1}</span>
                {ticket.workDescription && <small>{ticket.workDescription}</small>}
              </div>

              <div className="wt-property-cell">
                <strong>{ticket.propertyName || 'Unknown Property'}</strong>
                <span><MapPin size={12} /> {ticket.propertyAddress || 'Address not set'}</span>
              </div>

              <div className="wt-schedule-cell">
                <span className={`wt-badge ${isTicketScheduled(ticket) ? 'scheduled' : 'unscheduled'}`}>
                  {getScheduleLabel(ticket)}
                </span>
                <small>{formatDate(ticket.scheduledDate)}</small>
                <small>{crewName}</small>
              </div>

              <div className="wt-status-cell">
                <span className={`wt-badge ${isTicketClosed(ticket) ? 'closed' : 'open'}`}>
                  {getLifecycleLabel(ticket)}
                </span>
                <small>{String(ticket.status || 'unscheduled').replace('_', ' ')}</small>
              </div>

              <div className="wt-estimate-cell">
                <strong>{Number(ticket.estimatedHours || 0).toFixed(1)}h</strong>
                <span>{formatCurrency(ticket.estimatedPrice || 0)}</span>
              </div>

              <div className="wt-time-cell">
                <span className={`wt-badge wt-time-badge ${statusClass}`}>
                  {getTimeStatusLabel(ticket)}
                </span>
                <small>Actual: {formatDuration(totalWorkedMinutes)}</small>
                {workerLabel && <small>Worker: {workerLabel}</small>}
                {activeEntry && (
                  <small>
                    Shift: {formatClockTime(activeEntry.startAt)} - now ({formatDuration(shiftWorkedMinutes)})
                  </small>
                )}
              </div>

              <div className="wt-actions-cell">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => (isClockedIn(ticket) ? handleClockOut(ticket) : handleClockIn(ticket))}
                  disabled={isTicketClosed(ticket)}
                  title={isTicketClosed(ticket) ? 'Reopen ticket to track time.' : ''}
                >
                  {isClockedIn(ticket) ? 'Clock Out' : 'Clock In'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleLunch(ticket)}
                  disabled={isTicketClosed(ticket) || !isClockedIn(ticket)}
                  title={!isClockedIn(ticket) ? 'Clock in first.' : (isTicketClosed(ticket) ? 'Reopen ticket to track time.' : '')}
                >
                  Lunch +30m
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => toggleClosed(ticket)}
                >
                  {isTicketClosed(ticket) ? 'Reopen' : 'Close'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => toggleScheduled(ticket)}
                  disabled={isTicketClosed(ticket)}
                  title={isTicketClosed(ticket) ? 'Reopen ticket to schedule changes.' : ''}
                >
                  {isTicketScheduled(ticket) ? 'Unschedule' : 'Schedule'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default WorkTicketsPage;
