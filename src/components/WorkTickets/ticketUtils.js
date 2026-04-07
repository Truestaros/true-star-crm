const TICKETS_STORAGE_KEY = 'tsos-work-tickets-v1';
const CREWS_STORAGE_KEY = 'tsos-crews-v1';

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isTicketClosed(ticket) {
  const status = normalizeStatus(ticket?.status);
  return status === 'completed' || status === 'closed';
}

function isTicketScheduled(ticket) {
  return Boolean(ticket?.crewId && ticket?.scheduledDate);
}

function isTicketOpen(ticket) {
  return !isTicketClosed(ticket);
}

function loadTickets() {
  try {
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
  // Async sync to Supabase — fire and forget
  import('../../lib/db').then(({ upsertWorkTickets }) => {
    upsertWorkTickets(tickets).catch((err) => console.warn('Tickets sync to Supabase failed:', err));
  });
  window.dispatchEvent(new Event('work-tickets-updated'));
}

function loadCrews() {
  try {
    const raw = localStorage.getItem(CREWS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to defaults
  }
  const defaultCrews = [
    { id: 'crew-1', name: 'Crew Alpha', color: '#4A90D9' },
    { id: 'crew-2', name: 'Crew Bravo', color: '#D9534F' },
  ];
  localStorage.setItem(CREWS_STORAGE_KEY, JSON.stringify(defaultCrews));
  return defaultCrews;
}

function saveCrews(crews) {
  const list = Array.isArray(crews) ? crews : [];
  const normalized = list
    .map((crew, index) => {
      const id = String(crew?.id || '').trim() || `crew-${index + 1}`;
      const name = String(crew?.name || '').trim();
      const color = String(crew?.color || '').trim() || '#4A90D9';
      if (!name) return null;
      return { id, name, color };
    })
    .filter(Boolean);

  const nextCrews = normalized.length > 0
    ? normalized
    : [
        { id: 'crew-1', name: 'Crew Alpha', color: '#4A90D9' },
        { id: 'crew-2', name: 'Crew Bravo', color: '#D9534F' },
      ];

  localStorage.setItem(CREWS_STORAGE_KEY, JSON.stringify(nextCrews));
  // Async sync to Supabase — fire and forget
  import('../../lib/db').then(({ saveCrewsToDb }) => {
    saveCrewsToDb(nextCrews).catch((err) => console.warn('Crews sync to Supabase failed:', err));
  });
  window.dispatchEvent(new Event('work-crews-updated'));
  return nextCrews;
}

function serviceToTickets({
  estimate,
  service,
  propertyName = '',
  propertyAddress = '',
  nowISO,
}) {
  const freq = Math.max(1, Math.round(Number(service?.frequency || 1)));
  const sectionName = service?.category || 'General';
  const scope = service?.serviceName || service?.name || sectionName;
  const estimatedHours = Number(service?.hours || 0);
  const estimatedPrice = Number(service?.pricePerOccurrence || 0);

  return Array.from({ length: freq }, (_, index) => ({
    id: uid('tkt'),
    estimateId: estimate.id,
    estimateNumber: estimate.proposalNumber || '',
    sectionId: service?.id || uid('svc'),
    sectionName,
    sequenceNumber: index + 1,
    totalVisits: freq,
    propertyId: estimate.propertyId || '',
    propertyName,
    propertyAddress,
    scopeOfWork: scope,
    workDescription: `${scope} (${freq} visit${freq === 1 ? '' : 's'})`,
    estimatedHours,
    estimatedPrice,
    crewId: null,
    scheduledDate: null,
    status: 'unscheduled',
    notes: '',
    createdAt: nowISO,
    updatedAt: nowISO,
  }));
}

function generateWorkTicketsFromEstimate({
  estimate,
  propertyName = '',
  propertyAddress = '',
}) {
  if (!estimate || !estimate.id) return [];
  const services = Array.isArray(estimate.services) ? estimate.services : [];
  const includedServices = services.filter((service) => service?.isIncluded !== false);
  const nowISO = new Date().toISOString();

  return includedServices.flatMap((service) =>
    serviceToTickets({
      estimate,
      service,
      propertyName,
      propertyAddress,
      nowISO,
    }),
  );
}

function ensureEstimateTickets({
  estimate,
  propertyName = '',
  propertyAddress = '',
}) {
  if (!estimate || !estimate.id) {
    return { created: 0, tickets: [] };
  }

  const existingTickets = loadTickets();
  if (existingTickets.some((ticket) => ticket.estimateId === estimate.id)) {
    return { created: 0, tickets: existingTickets };
  }

  const newTickets = generateWorkTicketsFromEstimate({
    estimate,
    propertyName,
    propertyAddress,
  });
  if (newTickets.length === 0) {
    return { created: 0, tickets: existingTickets };
  }

  const merged = [...existingTickets, ...newTickets];
  saveTickets(merged);
  return { created: newTickets.length, tickets: merged };
}

export {
  TICKETS_STORAGE_KEY,
  CREWS_STORAGE_KEY,
  normalizeStatus,
  isTicketClosed,
  isTicketScheduled,
  isTicketOpen,
  loadTickets,
  saveTickets,
  loadCrews,
  saveCrews,
  generateWorkTicketsFromEstimate,
  ensureEstimateTickets,
};
