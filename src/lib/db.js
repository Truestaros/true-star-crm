/**
 * Data access layer — wraps all Supabase calls.
 * Every function returns plain JS objects matching the shape the app expects.
 */
import { supabase } from './supabase';

// ── helpers ────────────────────────────────────────────────────────────────

function snakeToCamel(obj) {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      snakeToCamel(v),
    ])
  );
}

function camelToSnake(obj) {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').toLowerCase(),
      camelToSnake(v),
    ])
  );
}

async function query(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return snakeToCamel(data);
}

// ── Property Managers ──────────────────────────────────────────────────────

export async function getPropertyManagers() {
  return query(
    supabase.from('property_managers').select('*').order('created_at', { ascending: false })
  );
}

export async function createPropertyManager(manager) {
  const row = camelToSnake({ ...manager, updatedAt: new Date().toISOString() });
  return query(supabase.from('property_managers').insert(row).select().single());
}

export async function updatePropertyManager(manager) {
  const { id, ...rest } = manager;
  const row = camelToSnake({ ...rest, updatedAt: new Date().toISOString() });
  return query(supabase.from('property_managers').update(row).eq('id', id).select().single());
}

// ── Properties ─────────────────────────────────────────────────────────────

export async function getProperties() {
  return query(
    supabase.from('properties').select('*').order('created_at', { ascending: false })
  );
}

export async function createProperty(property) {
  const row = camelToSnake({ ...property, updatedAt: new Date().toISOString() });
  return query(supabase.from('properties').insert(row).select().single());
}

export async function updatePropertyStage(id, dealStage) {
  return query(
    supabase
      .from('properties')
      .update(camelToSnake({ dealStage, lastStageChangeAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
      .eq('id', id)
      .select()
      .single()
  );
}

export async function updateProperty(property) {
  const { id, ...rest } = property;
  const row = camelToSnake({ ...rest, updatedAt: new Date().toISOString() });
  return query(supabase.from('properties').update(row).eq('id', id).select().single());
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function getNotes() {
  return query(
    supabase.from('notes').select('*').order('created_at', { ascending: false })
  );
}

export async function createNote(note) {
  const row = camelToSnake(note);
  return query(supabase.from('notes').insert(row).select().single());
}

// ── Estimates ──────────────────────────────────────────────────────────────

export async function getEstimates() {
  return query(
    supabase.from('estimates').select('*').order('created_at', { ascending: false })
  );
}

export async function upsertEstimate(estimate) {
  const row = camelToSnake({ ...estimate, updatedAt: new Date().toISOString() });
  return query(supabase.from('estimates').upsert(row).select().single());
}

export async function updateEstimateStatus(id, status, approvalNote = '') {
  return query(
    supabase
      .from('estimates')
      .update(camelToSnake({ status, approvalNote, updatedAt: new Date().toISOString() }))
      .eq('id', id)
      .select()
      .single()
  );
}

// ── Estimator Model (V6) ───────────────────────────────────────────────────

const ESTIMATOR_MODEL_ID = 'v6-main';

export async function loadEstimatorModel() {
  const { data, error } = await supabase
    .from('estimator_models')
    .select('model_data')
    .eq('id', ESTIMATOR_MODEL_ID)
    .maybeSingle();
  if (error) throw error;
  return data?.model_data ?? null;
}

export async function saveEstimatorModel(modelData) {
  const { error } = await supabase.from('estimator_models').upsert({
    id: ESTIMATOR_MODEL_ID,
    model_data: modelData,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Work Tickets ───────────────────────────────────────────────────────────

export async function getWorkTickets() {
  return query(
    supabase.from('work_tickets').select('*').order('created_at', { ascending: false })
  );
}

function ticketToRow(t) {
  return camelToSnake({
    id: t.id,
    estimateId: t.estimateId || null,
    estimateNumber: t.estimateNumber || '',
    sectionId: t.sectionId || '',
    sectionName: t.sectionName || '',
    sequenceNumber: t.sequenceNumber ?? 1,
    totalVisits: t.totalVisits ?? 1,
    propertyId: t.propertyId || '',
    propertyName: t.propertyName || '',
    propertyAddress: t.propertyAddress || '',
    scopeOfWork: t.scopeOfWork || '',
    workDescription: t.workDescription || '',
    estimatedHours: t.estimatedHours ?? 0,
    estimatedPrice: t.estimatedPrice ?? 0,
    crewId: t.crewId || null,
    scheduledDate: t.scheduledDate || null,
    status: t.status || 'unscheduled',
    notes: t.notes || '',
    timeEntries: t.timeEntries || [],
    activeTimeEntryId: t.activeTimeEntryId || null,
    activeLunchStartAt: t.activeLunchStartAt || null,
    updatedAt: new Date().toISOString(),
  });
}

export async function upsertWorkTickets(tickets) {
  if (!tickets || tickets.length === 0) return;
  const rows = tickets.map(ticketToRow);
  const { error } = await supabase.from('work_tickets').upsert(rows);
  if (error) throw error;
}

export async function upsertWorkTicket(ticket) {
  return query(supabase.from('work_tickets').upsert(ticketToRow(ticket)).select().single());
}

export async function updateWorkTicket(ticket) {
  const { id, ...rest } = ticket;
  const row = camelToSnake({ ...rest, updatedAt: new Date().toISOString() });
  return query(supabase.from('work_tickets').update(row).eq('id', id).select().single());
}

// ── Crews ──────────────────────────────────────────────────────────────────

export async function getCrews() {
  return query(supabase.from('crews').select('*').order('name'));
}

export async function saveCrewsToDb(crews) {
  const { error } = await supabase.from('crews').upsert(crews.map((c) => camelToSnake(c)));
  if (error) throw error;
  return crews;
}

// ── Activities ─────────────────────────────────────────────────────────────

export async function getActivities() {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return snakeToCamel(data);
}

export async function createActivity(activity) {
  const row = camelToSnake({ ...activity, updatedAt: new Date().toISOString() });
  return query(supabase.from('activities').insert(row).select().single());
}

export async function updateActivity(id, changes) {
  const row = camelToSnake({ ...changes, updatedAt: new Date().toISOString() });
  return query(supabase.from('activities').update(row).eq('id', id).select().single());
}

// ── App Settings ───────────────────────────────────────────────────────────

export async function loadSettingsFromDb() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('settings')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error) throw error;
  return data?.settings ?? null;
}

export async function saveSettingsToDb(settings) {
  const { error } = await supabase.from('app_settings').upsert({
    id: 'singleton',
    settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Service Catalog Items ───────────────────────────────────────────────────

export async function getCatalogItemsFromDb() {
  return query(
    supabase.from('catalog_items').select('*').order('name')
  );
}

export async function upsertCatalogItemsToDb(items) {
  if (!items || items.length === 0) return;
  const rows = items.map((item) => camelToSnake({
    id: item.id,
    itemNumber: item.itemNumber || '',
    source: item.source || 'custom',
    trade: item.trade || 'general',
    type: item.type || 'materials',
    name: item.name || '',
    description: item.description || '',
    unit: item.unit || 'ea',
    defaultQty: item.defaultQty ?? 1,
    defaultUnitCost: item.defaultUnitCost ?? 0,
    defaultHours: item.defaultHours ?? 0,
    laborCategory: item.laborCategory || null,
    defaultGmPct: item.defaultGmPct ?? 0,
    defaultOverheadPct: item.defaultOverheadPct ?? 0,
    defaultFrequency: item.defaultFrequency ?? 1,
    isOptional: item.isOptional ?? false,
    updatedAt: new Date().toISOString(),
  }));
  // Batch in chunks of 500 to stay within Supabase row limits
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from('catalog_items').upsert(chunk);
    if (error) throw error;
  }
}

export async function deleteCatalogItemFromDb(id) {
  const { error } = await supabase.from('catalog_items').delete().eq('id', id);
  if (error) throw error;
}

// ── Service Catalog Templates ───────────────────────────────────────────────

export async function getCatalogTemplatesFromDb() {
  return query(
    supabase.from('catalog_templates').select('*').order('name')
  );
}

export async function upsertCatalogTemplatesToDb(templates) {
  if (!templates || templates.length === 0) return;
  const rows = templates.map((tpl) => camelToSnake({
    id: tpl.id,
    name: tpl.name || '',
    description: tpl.description || '',
    billingType: tpl.billingType || 'fixed_price',
    sections: tpl.sections || [],
    updatedAt: new Date().toISOString(),
  }));
  const { error } = await supabase.from('catalog_templates').upsert(rows);
  if (error) throw error;
}

export async function deleteCatalogTemplateFromDb(id) {
  const { error } = await supabase.from('catalog_templates').delete().eq('id', id);
  if (error) throw error;
}
