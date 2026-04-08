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

const DEFAULT_CREWS = [
  { id: 'crew-1', name: 'Crew Alpha', color: '#4A90D9' },
  { id: 'crew-2', name: 'Crew Bravo', color: '#D9534F' },
];

// Sync fallbacks (localStorage) used only when Supabase is unreachable
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
  // Supabase is the source of truth — fire-and-forget from sync callers
  import('../../lib/db').then(({ upsertWorkTickets }) => {
    upsertWorkTickets(tickets).catch((err) => console.warn('Tickets sync to Supabase failed:', err));
  });
  window.dispatchEvent(new Event('work-tickets-updated'));
}

// Async loaders — used by components on mount
async function loadTicketsFromDb() {
  const { getWorkTickets } = await import('../../lib/db');
  try {
    const rows = await getWorkTickets();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return loadTickets(); // localStorage fallback
  }
}

function loadCrews() {
  try {
    const raw = localStorage.getItem(CREWS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through
  }
  return DEFAULT_CREWS;
}

async function loadCrewsFromDb() {
  const { getCrews } = await import('../../lib/db');
  try {
    const rows = await getCrews();
    return Array.isArray(rows) && rows.length > 0 ? rows : DEFAULT_CREWS;
  } catch {
    return loadCrews();
  }
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

  const nextCrews = normalized.length > 0 ? normalized : DEFAULT_CREWS;

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
  if (!estimate || !estimate.id) return { created: 0, tickets: [] };
  const existingTickets = loadTickets();
  if (existingTickets.some((ticket) => ticket.estimateId === estimate.id)) {
    return { created: 0, tickets: existingTickets };
  }
  const newTickets = generateWorkTicketsFromEstimate({ estimate, propertyName, propertyAddress });
  if (newTickets.length === 0) return { created: 0, tickets: existingTickets };
  const merged = [...existingTickets, ...newTickets];
  saveTickets(merged);
  return { created: newTickets.length, tickets: merged };
}

// Async version — fetches from Supabase so no localStorage dependency
async function ensureEstimateTicketsAsync({
  estimate,
  propertyName = '',
  propertyAddress = '',
}) {
  if (!estimate || !estimate.id) return { created: 0 };
  const { getWorkTickets, upsertWorkTickets } = await import('../../lib/db');
  const existing = await getWorkTickets();
  if (existing.some((ticket) => ticket.estimateId === estimate.id)) return { created: 0 };
  const newTickets = generateWorkTicketsFromEstimate({ estimate, propertyName, propertyAddress });
  if (newTickets.length === 0) return { created: 0 };
  await upsertWorkTickets(newTickets);
  return { created: newTickets.length };
}

export {
  TICKETS_STORAGE_KEY,
  CREWS_STORAGE_KEY,
  normalizeStatus,
  isTicketClosed,
  isTicketScheduled,
  isTicketOpen,
  loadTickets,
  loadTicketsFromDb,
  saveTickets,
  loadCrews,
  loadCrewsFromDb,
  saveCrews,
  generateWorkTicketsFromEstimate,
  ensureEstimateTickets,
  ensureEstimateTicketsAsync,
};
