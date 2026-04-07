import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Check, ArrowLeft, Copy, X } from 'lucide-react';
import mockServiceCatalog from '../../data/mockServiceCatalog.json';
import swNurseryCatalog from '../../data/swNurseryCatalog.json';
import {
  getCatalogItemsFromDb,
  upsertCatalogItemsToDb,
  deleteCatalogItemFromDb,
  getCatalogTemplatesFromDb,
  upsertCatalogTemplatesToDb,
  deleteCatalogTemplateFromDb,
} from '../../lib/db';
import './EstimatorV6Sandbox.css';

/* ═══════════════════════════════════════════════════
   Constants & Enums
   ═══════════════════════════════════════════════════ */

const ITEMS_STORAGE_KEY = 'tsos-catalog-items-v1';
const TEMPLATES_STORAGE_KEY = 'tsos-catalog-templates-v1';
const DEFAULT_TAX_RATE = 0.089;

const LABOR_RATES = {
  maintenance: { label: 'Maintenance', rate: 45 },
  planting:    { label: 'Planting',    rate: 60 },
  irrigation:  { label: 'Irrigation',  rate: 75 },
};

const TRADE_DIVISIONS = [
  { key: 'turf_care',   label: 'Turf Care' },
  { key: 'planting',    label: 'Planting' },
  { key: 'irrigation',  label: 'Irrigation' },
  { key: 'hardscape',   label: 'Hardscape' },
  { key: 'general',     label: 'General' },
];

const ITEM_TYPES = [
  { key: 'materials',     label: 'Materials' },
  { key: 'labor',         label: 'Labor' },
  { key: 'equipment',     label: 'Equipment' },
  { key: 'subcontractor', label: 'Subcontractor' },
];

const BILLING_TYPES = [
  { key: 'fixed_price',         label: 'Fixed Price',         desc: 'One-time total, invoiced on completion' },
  { key: 'time_and_materials',  label: 'Time & Materials',    desc: 'Billed at actual hours + materials' },
  { key: 'monthly',             label: 'Monthly',             desc: 'Contract total ÷ 12, invoiced monthly' },
  { key: 'progress_completion', label: 'Progress/Completion', desc: 'Split billing on milestones' },
];

const CATEGORY_TO_TRADE = {
  turf:           'turf_care',
  shrubs:         'planting',
  trees:          'planting',
  seasonal_color: 'planting',
  irrigation:     'irrigation',
  inspections:    'general',
  optional:       'general',
};
const TRADE_TO_LEGACY_CATEGORY = {
  turf_care: 'turf',
  planting: 'shrubs',
  irrigation: 'irrigation',
  hardscape: 'optional',
  general: 'inspections',
};
const AUTO_MAPPED_LEGACY_CATEGORIES = new Set(Object.values(TRADE_TO_LEGACY_CATEGORY));

function tradeLabel(key) {
  const t = TRADE_DIVISIONS.find((d) => d.key === key);
  return t ? t.label : key;
}

function typeLabel(key) {
  const t = ITEM_TYPES.find((d) => d.key === key);
  return t ? t.label : key;
}

function billingLabel(key) {
  const b = BILLING_TYPES.find((d) => d.key === key);
  return b ? b.label : key;
}

function laborCatLabel(key) {
  if (!key) return '—';
  const r = LABOR_RATES[key];
  return r ? r.label : key;
}

function resolveLegacyCategory(item) {
  if (item.isOptional) return 'optional';
  if (!item._legacyCategory) return TRADE_TO_LEGACY_CATEGORY[item.trade] || 'inspections';
  if (AUTO_MAPPED_LEGACY_CATEGORIES.has(item._legacyCategory)) {
    return TRADE_TO_LEGACY_CATEGORY[item.trade] || 'inspections';
  }
  return item._legacyCategory;
}

function resolveLegacyPricingType(item) {
  if (item._legacyPricingType) return item._legacyPricingType;
  if (item.type === 'labor') return 'hourly';
  return 'per_unit';
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ═══════════════════════════════════════════════════
   Migration — convert old mockServiceCatalog items
   ═══════════════════════════════════════════════════ */

function migrateOldItem(old) {
  const trade = CATEGORY_TO_TRADE[old.category] || 'general';

  // Infer item type from old pricing type
  let type = 'labor';
  if (old.pricingType === 'per_unit') type = 'materials';
  if (old.pricingType === 'flat_fee') type = 'labor';

  // Convert markup% → GM%: markup / (100 + markup) * 100
  const gmPct = old.defaultMarkup > 0
    ? Math.round((old.defaultMarkup / (100 + old.defaultMarkup)) * 100 * 100) / 100
    : 0;

  return {
    id: old.id,
    trade,
    type,
    name: old.name,
    description: old.description || '',
    unit: old.pricingType === 'hourly' ? 'Hr'
        : old.pricingType === 'per_unit' ? (old.unitLabel || 'unit')
        : 'ea',
    defaultQty: old.pricingType === 'hourly' ? (old.defaultHours || 0)
              : old.pricingType === 'per_unit' ? (old.defaultQuantity || 0)
              : 1,
    defaultUnitCost: old.pricingType === 'hourly' ? (old.defaultHourlyRate || 0)
                   : old.pricingType === 'per_unit' ? (old.defaultUnitCost || 0)
                   : (old.defaultFlatFee || 0),
    defaultHours: old.defaultHours || 0,
    laborCategory: old.pricingType === 'hourly'
      ? (old.category === 'irrigation' ? 'irrigation' : 'maintenance')
      : null,
    defaultGmPct: gmPct,
    defaultOverheadPct: Math.round(gmPct * 0.75 * 100) / 100,
    defaultFrequency: old.defaultFrequency || 1,
    isOptional: old.isOptional || false,
    _legacyCategory: old.category,
    _legacyPricingType: old.pricingType,
    _legacyMarkup: old.defaultMarkup || 0,
    createdAt: old.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════
   Southwest Nursery catalog expansion
   ═══════════════════════════════════════════════════ */

const TRADE_CODE_MAP = { p: 'planting', i: 'irrigation', h: 'hardscape', t: 'turf_care', g: 'general' };

function expandSwNurseryItem([itemNumber, name, price, tradeCode]) {
  return {
    id: `sw-nursery-${itemNumber}`,
    itemNumber,
    source: 'Southwest Nursery',
    trade: TRADE_CODE_MAP[tradeCode] || 'planting',
    type: 'materials',
    name,
    description: '',
    unit: 'ea',
    defaultQty: 1,
    defaultUnitCost: price,
    defaultHours: 0,
    laborCategory: null,
    defaultGmPct: 0,
    defaultOverheadPct: 0,
    defaultFrequency: 1,
    isOptional: false,
    createdAt: '2026-04-07T00:00:00.000Z',
    updatedAt: '2026-04-07T00:00:00.000Z',
  };
}

function buildSeedItems() {
  const custom = mockServiceCatalog.map(migrateOldItem);
  const nursery = (swNurseryCatalog.items || []).map(expandSwNurseryItem);
  return [...custom, ...nursery];
}

/* ═══════════════════════════════════════════════════
   localStorage / Supabase persistence
   ═══════════════════════════════════════════════════ */

function loadItemsFromStorage() {
  try {
    const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return null; // signals "not yet seeded locally"
}

function saveItemsToStorage(items) {
  localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('catalog-items-changed'));
}

function loadTemplatesFromStorage() {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function saveTemplatesToStorage(templates) {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

// Legacy synchronous loader — returns from cache or seeds immediately
function loadItems() {
  const cached = loadItemsFromStorage();
  if (cached) return cached;
  const seeded = buildSeedItems();
  saveItemsToStorage(seeded);
  return seeded;
}

function loadTemplates() {
  return loadTemplatesFromStorage();
}

function saveItems(items) {
  saveItemsToStorage(items);
  // Async Supabase sync — fire and forget
  upsertCatalogItemsToDb(items).catch((err) =>
    console.warn('Catalog items Supabase sync failed:', err)
  );
}

function saveTemplates(templates) {
  saveTemplatesToStorage(templates);
  if (templates.length > 0) {
    upsertCatalogTemplatesToDb(templates).catch((err) =>
      console.warn('Catalog templates Supabase sync failed:', err)
    );
  }
}

/* ═══════════════════════════════════════════════════
   Legacy bridge — for EstimateBuilderPage compatibility
   ═══════════════════════════════════════════════════ */

function buildLegacyServiceArray(v2Items) {
  return v2Items.map((item) => {
    const pricingType = resolveLegacyPricingType(item);
    return {
      id: item.id,
      category: resolveLegacyCategory(item),
      name: item.name,
      description: item.description,
      pricingType,
      defaultHours: item.defaultHours || 0,
      defaultHourlyRate: pricingType === 'hourly' ? item.defaultUnitCost : 0,
      defaultQuantity: pricingType === 'per_unit' ? item.defaultQty : 0,
      defaultUnitCost: pricingType === 'per_unit' ? item.defaultUnitCost : 0,
      unitLabel: item.unit || '',
      defaultFlatFee: pricingType === 'flat_fee' ? item.defaultUnitCost : 0,
      defaultFrequency: item.defaultFrequency || 1,
      defaultMarkup: item._legacyMarkup || 0,
      isOptional: item.isOptional || false,
      createdAt: item.createdAt,
    };
  });
}

// Export for App.js bridge
export { buildLegacyServiceArray, ITEMS_STORAGE_KEY };

/* ═══════════════════════════════════════════════════
   Default item/template factories
   ═══════════════════════════════════════════════════ */

function createDefaultItem() {
  return {
    id: uid('cat-item'),
    itemNumber: '',
    source: 'custom',
    trade: 'turf_care',
    type: 'labor',
    name: '',
    description: '',
    unit: 'Hr',
    defaultQty: 1,
    defaultUnitCost: 0,
    defaultHours: 0,
    laborCategory: null,
    defaultGmPct: 40,
    defaultOverheadPct: 30,
    defaultFrequency: 1,
    isOptional: false,
    _legacyCategory: 'turf',
    _legacyPricingType: 'hourly',
    _legacyMarkup: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultTemplate() {
  return {
    id: uid('cat-tpl'),
    name: '',
    description: '',
    billingType: 'fixed_price',
    sections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultSection() {
  return {
    id: uid('cat-sec'),
    name: 'New Section',
    scopeName: 'New Scope',
    frequency: 1,
    complexityPct: 0,
    taxRate: DEFAULT_TAX_RATE,
    items: [],
  };
}

function catalogItemToTemplateItem(catItem) {
  return {
    id: uid('tpl-item'),
    catalogItemId: catItem.id,
    name: catItem.name,
    quantity: catItem.defaultQty || 1,
    unit: catItem.unit || 'ea',
    hours: catItem.defaultHours || 0,
    unitCost: catItem.defaultUnitCost || 0,
    laborCategory: catItem.laborCategory || null,
    gmPct: catItem.defaultGmPct || 40,
    overheadPct: catItem.defaultOverheadPct || 30,
  };
}


/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

function ServiceCatalogPage({ currentRole, permissions }) {
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState(loadItems);
  const [templates, setTemplates] = useState(loadTemplates);
  const [dbStatus, setDbStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const seededRef = useRef(false);

  // On mount: load from Supabase and merge / seed if needed
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setDbStatus('syncing');

    Promise.all([getCatalogItemsFromDb(), getCatalogTemplatesFromDb()])
      .then(([dbItems, dbTemplates]) => {
        if (dbItems && dbItems.length > 0) {
          // Supabase has data — use it as the source of truth
          saveItemsToStorage(dbItems);
          setItems(dbItems);
        } else {
          // Supabase empty — seed everything up
          const seed = buildSeedItems();
          saveItemsToStorage(seed);
          setItems(seed);
          upsertCatalogItemsToDb(seed).catch((err) =>
            console.warn('Initial catalog seed to Supabase failed:', err)
          );
        }
        if (dbTemplates && dbTemplates.length > 0) {
          saveTemplatesToStorage(dbTemplates);
          setTemplates(dbTemplates);
        }
        setDbStatus('synced');
      })
      .catch((err) => {
        console.warn('Catalog Supabase load failed, using localStorage:', err);
        setDbStatus('error');
      });
  }, []);

  // Persist items/templates to localStorage + Supabase on every change
  // (skip the very first render — already loaded from storage above)
  const itemsInitRef = useRef(true);
  useEffect(() => {
    if (itemsInitRef.current) { itemsInitRef.current = false; return; }
    saveItems(items);
  }, [items]);

  const templatesInitRef = useRef(true);
  useEffect(() => {
    if (templatesInitRef.current) { templatesInitRef.current = false; return; }
    saveTemplates(templates);
  }, [templates]);

  const canEdit = permissions?.canEditCatalog;

  return (
    <div className="panel-card">
      <div className="crm-header" style={{ marginBottom: 16 }}>
        <div>
          <h1>Service Catalog</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Manage catalog items and estimate templates.
            {!canEdit && <span className="sc2-readonly-notice"> Read-only for {currentRole}.</span>}
            {dbStatus === 'syncing' && <span style={{ marginLeft: 8, color: 'var(--muted)' }}>⟳ Syncing…</span>}
            {dbStatus === 'synced' && <span style={{ marginLeft: 8, color: '#5a7a5f' }}>✓ {items.length.toLocaleString()} items loaded</span>}
            {dbStatus === 'error' && <span style={{ marginLeft: 8, color: '#c0392b' }}>⚠ Offline — using local cache</span>}
          </p>
        </div>
      </div>

      <div className="sc2-tab-bar">
        <button
          className={`sc2-tab-btn ${activeTab === 'items' ? 'active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          Items ({items.length})
        </button>
        <button
          className={`sc2-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates ({templates.length})
        </button>
      </div>

      {activeTab === 'items' ? (
        <ItemsTab items={items} setItems={setItems} canEdit={canEdit} />
      ) : (
        <TemplatesTab
          templates={templates}
          setTemplates={setTemplates}
          catalogItems={items}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   ITEMS TAB
   ═══════════════════════════════════════════════════ */

function ItemsTab({ items, setItems, canEdit }) {
  const [selectedTrade, setSelectedTrade] = useState('all');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [collapsedTrades, setCollapsedTrades] = useState({});

  // Trade counts for sidebar badges
  const tradeCounts = useMemo(() => {
    const counts = {};
    TRADE_DIVISIONS.forEach((t) => { counts[t.key] = 0; });
    items.forEach((item) => { if (counts[item.trade] !== undefined) counts[item.trade]++; });
    return counts;
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesTrade = selectedTrade === 'all' || item.trade === selectedTrade;
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(item.type);
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTrade && matchesType && matchesSearch;
    });
  }, [items, selectedTrade, selectedTypes, searchQuery]);

  function handleToggleTrade(tradeKey) {
    if (selectedTrade === tradeKey) {
      setSelectedTrade('all');
    } else {
      setSelectedTrade(tradeKey);
    }
    setSelectedTypes([]);
  }

  function handleToggleType(typeKey) {
    setSelectedTypes((prev) =>
      prev.includes(typeKey) ? prev.filter((t) => t !== typeKey) : [...prev, typeKey],
    );
  }

  function handleToggleCollapse(tradeKey) {
    setCollapsedTrades((prev) => ({ ...prev, [tradeKey]: !prev[tradeKey] }));
  }

  function handleSaveItem(item) {
    const normalized = {
      ...item,
      _legacyCategory: resolveLegacyCategory(item),
      _legacyPricingType: resolveLegacyPricingType(item),
    };

    setItems((prev) => {
      const exists = prev.find((i) => i.id === normalized.id);
      if (exists) {
        return prev.map((i) => (i.id === normalized.id ? { ...normalized, updatedAt: new Date().toISOString() } : i));
      }
      return [normalized, ...prev];
    });
    setEditingItem(null);
  }

  function handleDeleteItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    deleteCatalogItemFromDb(id).catch((err) =>
      console.warn('Delete catalog item from Supabase failed:', err)
    );
  }

  return (
    <>
      <div className="sc2-items-layout">
        {/* Sidebar */}
        <div className="sc2-sidebar">
          <button
            className={`sc2-sidebar-all ${selectedTrade === 'all' ? 'active' : ''}`}
            onClick={() => { setSelectedTrade('all'); setSelectedTypes([]); }}
          >
            All Items ({items.length})
          </button>

          {TRADE_DIVISIONS.map((trade) => (
            <div key={trade.key} className="sc2-sidebar-group">
              <button
                className={`sc2-sidebar-group-header ${selectedTrade === trade.key ? 'active' : ''}`}
                onClick={() => handleToggleTrade(trade.key)}
              >
                <span
                  style={{ cursor: 'pointer', display: 'flex' }}
                  onClick={(e) => { e.stopPropagation(); handleToggleCollapse(trade.key); }}
                >
                  {collapsedTrades[trade.key] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </span>
                {trade.label}
                <span className="sc2-sidebar-group-count">{tradeCounts[trade.key] || 0}</span>
              </button>

              {!collapsedTrades[trade.key] && selectedTrade === trade.key && (
                <div className="sc2-sidebar-types">
                  {ITEM_TYPES.map((type) => (
                    <label key={type.key} className="sc2-sidebar-type-check">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type.key)}
                        onChange={() => handleToggleType(type.key)}
                      />
                      {type.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="sc2-items-main">
          <div className="sc2-items-toolbar">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="sc2-items-count">{filteredItems.length} items</span>
            {canEdit && (
              <button className="primary" style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => setEditingItem(createDefaultItem())}>
                + Add Item
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="sc2-empty">
              <strong>No items found</strong>
              {searchQuery ? 'Try a different search.' : 'Add your first catalog item.'}
            </div>
          ) : (
            <table className="sc2-table">
              <colgroup>
                <col className="sc2-col-name" />
                <col className="sc2-col-trade" />
                <col className="sc2-col-type" />
                <col className="sc2-col-unit" />
                <col className="sc2-col-qty" />
                <col className="sc2-col-cost" />
                <col className="sc2-col-hours" />
                <col className="sc2-col-labor" />
                <col className="sc2-col-gm" />
                <col className="sc2-col-opt" />
                <col className="sc2-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Trade</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th className="right">Qty</th>
                  <th className="right">Unit Cost</th>
                  <th className="right">Hours</th>
                  <th>Labor Cat</th>
                  <th className="right">GM%</th>
                  <th className="center">Opt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="sc2-item-name">{item.name}</div>
                      {item.description && <div className="sc2-item-desc">{item.description}</div>}
                    </td>
                    <td>
                      <span className={`sc2-trade-pill pill-${item.trade}`}>{tradeLabel(item.trade)}</span>
                    </td>
                    <td><span className="sc2-type-badge">{typeLabel(item.type)}</span></td>
                    <td>{item.unit}</td>
                    <td className="right">{item.defaultQty}</td>
                    <td className="right">{formatCurrency(item.defaultUnitCost)}</td>
                    <td className="right">{item.defaultHours || '—'}</td>
                    <td>{laborCatLabel(item.laborCategory)}</td>
                    <td className="right">{item.defaultGmPct}%</td>
                    <td className="center">{item.isOptional ? '✓' : ''}</td>
                    <td>
                      <button className="sc2-action-btn" disabled={!canEdit} onClick={() => setEditingItem({ ...item })}>
                        Edit
                      </button>
                      <button className="sc2-action-btn danger" disabled={!canEdit} onClick={() => handleDeleteItem(item.id)}>
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Item Edit Modal */}
      {editingItem && canEdit && (
        <ItemEditModal
          item={editingItem}
          isNew={!items.find((i) => i.id === editingItem.id)}
          onSave={handleSaveItem}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </>
  );
}


/* ═══════════════════════════════════════════════════
   ITEM EDIT MODAL
   ═══════════════════════════════════════════════════ */

function ItemEditModal({ item, isNew, onSave, onCancel }) {
  const [form, setForm] = useState({ ...item });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, padding: 28 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
          {isNew ? 'Add' : 'Edit'} Catalog Item
        </h2>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 13 }}>
          Define default values for estimate line items.
        </p>

        <div className="sc2-modal-form">
          {/* Row 1: Name (full width) */}
          <div className="sc2-form-field full">
            <span className="sc2-form-label">Name *</span>
            <input className="sc2-form-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g., Irrigated Turf Mow" />
          </div>

          {/* Row 2: Description (full width) */}
          <div className="sc2-form-field full">
            <span className="sc2-form-label">Description</span>
            <textarea className="sc2-form-textarea" rows={2} value={form.description || ''} onChange={(e) => update('description', e.target.value)} placeholder="Optional description" />
          </div>

          {/* Row 3: Trade + Type */}
          <div className="sc2-form-row">
            <div className="sc2-form-field">
              <span className="sc2-form-label">Trade Division</span>
              <select className="sc2-form-select" value={form.trade} onChange={(e) => update('trade', e.target.value)}>
                {TRADE_DIVISIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="sc2-form-field">
              <span className="sc2-form-label">Item Type</span>
              <select className="sc2-form-select" value={form.type} onChange={(e) => update('type', e.target.value)}>
                {ITEM_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Unit + Qty */}
          <div className="sc2-form-row">
            <div className="sc2-form-field">
              <span className="sc2-form-label">Unit</span>
              <input className="sc2-form-input" value={form.unit || ''} onChange={(e) => update('unit', e.target.value)} placeholder="Hr, sqft, gal..." />
            </div>
            <div className="sc2-form-field">
              <span className="sc2-form-label">Default Quantity</span>
              <input className="sc2-form-input" type="number" value={form.defaultQty || ''} onChange={(e) => update('defaultQty', Number(e.target.value))} />
            </div>
          </div>

          {/* Row 5: Unit Cost + Hours */}
          <div className="sc2-form-row">
            <div className="sc2-form-field">
              <span className="sc2-form-label">Default Unit Cost ($)</span>
              <input className="sc2-form-input" type="number" step="0.01" value={form.defaultUnitCost || ''} onChange={(e) => update('defaultUnitCost', Number(e.target.value))} />
            </div>
            <div className="sc2-form-field">
              <span className="sc2-form-label">Default Hours</span>
              <input className="sc2-form-input" type="number" step="0.5" value={form.defaultHours || ''} onChange={(e) => update('defaultHours', Number(e.target.value))} />
            </div>
          </div>

          {/* Row 6: Labor Cat + GM% */}
          <div className="sc2-form-row">
            <div className="sc2-form-field">
              <span className="sc2-form-label">Labor Category</span>
              <select className="sc2-form-select" value={form.laborCategory || ''} onChange={(e) => update('laborCategory', e.target.value || null)}>
                <option value="">None</option>
                {Object.entries(LABOR_RATES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label} (${LABOR_RATES[key].rate}/hr)</option>
                ))}
              </select>
            </div>
            <div className="sc2-form-field">
              <span className="sc2-form-label">Default GM%</span>
              <input className="sc2-form-input" type="number" step="0.5" value={form.defaultGmPct || ''} onChange={(e) => update('defaultGmPct', Number(e.target.value))} />
            </div>
          </div>

          {/* Row 7: Overhead% + Frequency */}
          <div className="sc2-form-row">
            <div className="sc2-form-field">
              <span className="sc2-form-label">Default Overhead%</span>
              <input className="sc2-form-input" type="number" step="0.5" value={form.defaultOverheadPct || ''} onChange={(e) => update('defaultOverheadPct', Number(e.target.value))} />
            </div>
            <div className="sc2-form-field">
              <span className="sc2-form-label">Default Frequency (visits/year)</span>
              <input className="sc2-form-input" type="number" value={form.defaultFrequency || ''} onChange={(e) => update('defaultFrequency', Number(e.target.value))} />
            </div>
          </div>

          {/* Row 8: Optional checkbox */}
          <label className="sc2-form-checkbox">
            <input type="checkbox" checked={form.isOptional || false} onChange={(e) => update('isOptional', e.target.checked)} />
            Optional Service
          </label>

          {/* Actions */}
          <div className="sc2-modal-actions">
            <button className="secondary" onClick={onCancel}>Cancel</button>
            <button className="primary" onClick={handleSubmit}>Save Item</button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   TEMPLATES TAB
   ═══════════════════════════════════════════════════ */

function TemplatesTab({ templates, setTemplates, catalogItems, canEdit }) {
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');

  const editingTemplate = editingTemplateId
    ? templates.find((t) => t.id === editingTemplateId) || null
    : null;

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter((t) =>
      t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)),
    );
  }, [templates, templateSearch]);

  function handleAddTemplate() {
    const newTpl = createDefaultTemplate();
    newTpl.name = 'New Template';
    setTemplates((prev) => [newTpl, ...prev]);
    setEditingTemplateId(newTpl.id);
  }

  function handleDuplicate(tpl) {
    if (!canEdit) return;
    const clone = JSON.parse(JSON.stringify(tpl));
    clone.id = uid('cat-tpl');
    clone.name = `${tpl.name} (Copy)`;
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = new Date().toISOString();
    // Regenerate section/item IDs
    clone.sections = clone.sections.map((sec) => ({
      ...sec,
      id: uid('cat-sec'),
      items: sec.items.map((item) => ({ ...item, id: uid('tpl-item') })),
    }));
    setTemplates((prev) => [clone, ...prev]);
  }

  function handleDeleteTemplate(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingTemplateId === id) setEditingTemplateId(null);
    deleteCatalogTemplateFromDb(id).catch((err) =>
      console.warn('Delete catalog template from Supabase failed:', err)
    );
  }

  function updateTemplate(id, updates) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)),
    );
  }

  // ── Editor view ──
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        updateTemplate={(updates) => updateTemplate(editingTemplate.id, updates)}
        catalogItems={catalogItems}
        canEdit={canEdit}
        onBack={() => setEditingTemplateId(null)}
      />
    );
  }

  // ── List view ──
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search templates..."
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        {canEdit && (
          <button className="primary" style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={handleAddTemplate}>
            + Add Template
          </button>
        )}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="sc2-empty">
          <strong>No templates yet</strong>
          Create your first estimate template.
        </div>
      ) : (
        <div className="sc2-templates-list">
          {filteredTemplates.map((tpl) => {
            const itemCount = tpl.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
            return (
              <div key={tpl.id} className="sc2-template-card">
                <div className="sc2-template-info">
                  <div className="sc2-template-name">{tpl.name || 'Untitled Template'}</div>
                  <div className="sc2-template-meta">
                    <span className={`sc2-billing-badge ${tpl.billingType}`}>{billingLabel(tpl.billingType)}</span>
                    <span>{tpl.sections.length} section{tpl.sections.length !== 1 ? 's' : ''}</span>
                    <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="sc2-template-actions">
                  <button className="sc2-action-btn" onClick={() => setEditingTemplateId(tpl.id)} disabled={!canEdit}>
                    Edit
                  </button>
                  <button className="sc2-action-btn" onClick={() => handleDuplicate(tpl)} title="Duplicate" disabled={!canEdit}>
                    <Copy size={13} />
                  </button>
                  <button className="sc2-action-btn danger" disabled={!canEdit} onClick={() => handleDeleteTemplate(tpl.id)}>
                    Del
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   TEMPLATE EDITOR
   ═══════════════════════════════════════════════════ */

function TemplateEditor({ template, updateTemplate, catalogItems, canEdit, onBack }) {
  const [collapsedSections, setCollapsedSections] = useState({});
  const [pickerSectionId, setPickerSectionId] = useState(null);

  function toggleSection(secId) {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  }

  // ── Section CRUD ──
  function addSection() {
    updateTemplate({ sections: [...template.sections, createDefaultSection()] });
  }

  function removeSection(secId) {
    updateTemplate({ sections: template.sections.filter((s) => s.id !== secId) });
  }

  function updateSection(secId, updates) {
    updateTemplate({
      sections: template.sections.map((s) => (s.id === secId ? { ...s, ...updates } : s)),
    });
  }

  // ── Item CRUD within sections ──
  function addItemsToSection(secId, catItems) {
    const newItems = catItems.map(catalogItemToTemplateItem);
    updateTemplate({
      sections: template.sections.map((s) =>
        s.id === secId ? { ...s, items: [...s.items, ...newItems] } : s,
      ),
    });
  }

  function removeItemFromSection(secId, itemId) {
    updateTemplate({
      sections: template.sections.map((s) =>
        s.id === secId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    });
  }

  function updateItemInSection(secId, itemId, updates) {
    updateTemplate({
      sections: template.sections.map((s) =>
        s.id === secId
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)) }
          : s,
      ),
    });
  }

  return (
    <div>
      <button className="sc2-editor-back" onClick={onBack}>
        <ArrowLeft size={14} /> Back to Templates
      </button>

      {/* Template header fields */}
      <div className="sc2-editor-header">
        <div className="sc2-form-field">
          <span className="sc2-form-label">Template Name</span>
          <input
            className="sc2-form-input"
            value={template.name}
            onChange={(e) => updateTemplate({ name: e.target.value })}
            placeholder="e.g., Annual Maintenance"
            readOnly={!canEdit}
          />
        </div>
        <div className="sc2-form-field">
          <span className="sc2-form-label">Billing Type</span>
          <select
            className="sc2-form-select"
            value={template.billingType}
            onChange={(e) => updateTemplate({ billingType: e.target.value })}
            disabled={!canEdit}
          >
            {BILLING_TYPES.map((b) => (
              <option key={b.key} value={b.key}>{b.label} — {b.desc}</option>
            ))}
          </select>
        </div>
        <div className="sc2-form-field full">
          <span className="sc2-form-label">Description</span>
          <textarea
            className="sc2-form-textarea"
            rows={2}
            value={template.description || ''}
            onChange={(e) => updateTemplate({ description: e.target.value })}
            placeholder="Optional template description"
            readOnly={!canEdit}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="sc2-sections-label">Sections</div>

      {template.sections.length === 0 && (
        <div className="sc2-empty" style={{ padding: '24px 20px' }}>
          <strong>No sections yet</strong>
          Add a section to start building this template.
        </div>
      )}

      {template.sections.map((section) => {
        const isCollapsed = collapsedSections[section.id];
        return (
          <div key={section.id} className="sc2-section">
            <div className="sc2-section-header" onClick={() => toggleSection(section.id)}>
              <span className="sc2-section-toggle">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </span>
              <input
                className="sc2-section-name-input"
                value={section.name}
                onChange={(e) => { e.stopPropagation(); updateSection(section.id, { name: e.target.value }); }}
                onClick={(e) => e.stopPropagation()}
                readOnly={!canEdit}
                placeholder="Section Name"
              />
              <div className="sc2-section-freq" onClick={(e) => e.stopPropagation()}>
                <span>Freq:</span>
                <input
                  type="number"
                  value={section.frequency || 1}
                  onChange={(e) => updateSection(section.id, { frequency: Math.max(1, parseInt(e.target.value) || 1) })}
                  readOnly={!canEdit}
                  min="1"
                />
              </div>
              {canEdit && (
                <div className="sc2-section-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="sc2-action-btn"
                    onClick={() => setPickerSectionId(section.id)}
                    style={{ fontSize: 11 }}
                  >
                    <Plus size={12} /> Item
                  </button>
                  <button className="sc2-action-btn danger" onClick={() => removeSection(section.id)} style={{ fontSize: 11 }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="sc2-section-items">
                {section.items.length > 0 && (
                  <div className="sc2-section-item-header">
                    <span>Name</span>
                    <span style={{ textAlign: 'right' }}>Qty</span>
                    <span style={{ textAlign: 'right' }}>Unit</span>
                    <span style={{ textAlign: 'right' }}>Unit Cost</span>
                    <span style={{ textAlign: 'right' }}>Hours</span>
                    <span>Labor Cat</span>
                    <span style={{ textAlign: 'right' }}>GM%</span>
                    <span style={{ textAlign: 'right' }}>OH%</span>
                    <span></span>
                  </div>
                )}
                {section.items.map((tplItem) => (
                  <div key={tplItem.id} className="sc2-section-item-row">
                    <input
                      className="sc2-section-item-input name-input"
                      value={tplItem.name}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { name: e.target.value })}
                      readOnly={!canEdit}
                    />
                    <input
                      className="sc2-section-item-input"
                      type="number"
                      value={tplItem.quantity || ''}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { quantity: Number(e.target.value) })}
                      readOnly={!canEdit}
                    />
                    <input
                      className="sc2-section-item-input"
                      value={tplItem.unit || ''}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { unit: e.target.value })}
                      readOnly={!canEdit}
                      style={{ textAlign: 'left' }}
                    />
                    <input
                      className="sc2-section-item-input"
                      type="number"
                      step="0.01"
                      value={tplItem.unitCost || ''}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { unitCost: Number(e.target.value) })}
                      readOnly={!canEdit}
                    />
                    <input
                      className="sc2-section-item-input"
                      type="number"
                      step="0.5"
                      value={tplItem.hours || ''}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { hours: Number(e.target.value) })}
                      readOnly={!canEdit}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {laborCatLabel(tplItem.laborCategory)}
                    </span>
                    <input
                      className="sc2-section-item-input"
                      type="number"
                      step="0.5"
                      value={tplItem.gmPct || ''}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { gmPct: Number(e.target.value) })}
                      readOnly={!canEdit}
                    />
                    <input
                      className="sc2-section-item-input"
                      type="number"
                      step="0.5"
                      value={tplItem.overheadPct || ''}
                      onChange={(e) => updateItemInSection(section.id, tplItem.id, { overheadPct: Number(e.target.value) })}
                      readOnly={!canEdit}
                    />
                    {canEdit && (
                      <button className="sc2-section-item-remove" onClick={() => removeItemFromSection(section.id, tplItem.id)}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {section.items.length === 0 && (
                  <div style={{ padding: '12px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                    No items yet. Add items from the catalog.
                  </div>
                )}
                {canEdit && (
                  <button className="sc2-section-add-item" onClick={() => setPickerSectionId(section.id)}>
                    <Plus size={12} /> Add Item from Catalog
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {canEdit && (
        <button className="sc2-add-section-btn" onClick={addSection}>
          <Plus size={14} /> Add Section
        </button>
      )}

      {/* Catalog Item Picker Modal */}
      {pickerSectionId && (
        <CatalogItemPicker
          items={catalogItems}
          onAdd={(selected) => {
            addItemsToSection(pickerSectionId, selected);
            setPickerSectionId(null);
          }}
          onCancel={() => setPickerSectionId(null)}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   CATALOG ITEM PICKER MODAL
   ═══════════════════════════════════════════════════ */

function CatalogItemPicker({ items, onAdd, onCancel }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || (i.description && i.description.toLowerCase().includes(q)),
    );
  }, [items, search]);

  function toggleItem(item) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.id === item.id);
      if (exists) return prev.filter((s) => s.id !== item.id);
      return [...prev, item];
    });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580, padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Add Items from Catalog</h2>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12 }}>
          Select items to add to this section. Defaults can be overridden after adding.
        </p>

        <input
          className="sc2-picker-search"
          type="text"
          placeholder="Search catalog items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="sc2-picker-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              No items found.
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = selected.some((s) => s.id === item.id);
              return (
                <div
                  key={item.id}
                  className={`sc2-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleItem(item)}
                >
                  <div className="sc2-picker-item-check">
                    {isSelected && <Check size={12} />}
                  </div>
                  <div className="sc2-picker-item-info">
                    <div className="sc2-picker-item-name">{item.name}</div>
                    <div className="sc2-picker-item-detail">
                      {tradeLabel(item.trade)} · {typeLabel(item.type)} · {item.unit} · {formatCurrency(item.defaultUnitCost)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="sc2-modal-actions" style={{ marginTop: 14 }}>
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button
            className="primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            Add {selected.length} Item{selected.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}


export default ServiceCatalogPage;
