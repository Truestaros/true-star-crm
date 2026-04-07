import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, ChevronDown, ChevronRight, FileText, GripVertical, MoreVertical, Plus, PlusCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../Estimates/EstimatorV6Sandbox.css';
import { loadSettings, SETTINGS_STORAGE_KEY } from '../Settings/settingsStorage';
import { loadTickets, saveTickets } from '../WorkTickets/ticketUtils';

const STORAGE_KEY = 'tsos-estimator-v6-main-v1';
const LEGACY_STORAGE_PREFIX = 'tsos-estimator-v6-sandbox';
const DEFAULT_TAX_RATE = 0.089;
const DEFAULT_CONTRACT_TERM_MONTHS = 12;
const DEFAULT_MARGIN_GATE_PCT = 35;
const DEFAULT_NET_PAYMENT_TERM = 'net_30';
const PAYMENT_TERM_OPTIONS = [1, 3, 12, 24];
const NET_PAYMENT_TERM_OPTIONS = [
  { value: 'pay_upon_receipt', label: 'Pay Upon Receipt' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];

function normalizePaymentTermMonths(value) {
  const next = Math.round(Number(value || DEFAULT_CONTRACT_TERM_MONTHS));
  if (PAYMENT_TERM_OPTIONS.includes(next)) return next;
  return DEFAULT_CONTRACT_TERM_MONTHS;
}

function normalizeNetPaymentTerm(value) {
  const raw = String(value || '').trim();
  return NET_PAYMENT_TERM_OPTIONS.some((item) => item.value === raw)
    ? raw
    : DEFAULT_NET_PAYMENT_TERM;
}

function netPaymentTermLabel(value) {
  const found = NET_PAYMENT_TERM_OPTIONS.find((item) => item.value === value);
  return found ? found.label : 'Net 30';
}

function getSettingsDefaults() {
  const settings = loadSettings();
  return {
    contractTermMonths: Math.max(
      1,
      Math.round(Number(settings.contractTermMonths || DEFAULT_CONTRACT_TERM_MONTHS)),
    ),
    minMarginGatePct: Math.max(
      0,
      Number(settings.minMarginGatePct ?? DEFAULT_MARGIN_GATE_PCT),
    ),
  };
}

function loadRawModel() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return current;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(LEGACY_STORAGE_PREFIX)) continue;
    const legacyRaw = localStorage.getItem(key);
    if (!legacyRaw) continue;
    localStorage.setItem(STORAGE_KEY, legacyRaw);
    return legacyRaw;
  }

  return null;
}

/* ── Labor rate catalog ── */
const LABOR_RATES = {
  maintenance:  { label: 'Maintenance',  rate: 45 },
  planting:     { label: 'Planting',     rate: 60 },
  irrigation:   { label: 'Irrigation',   rate: 75 },
};

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

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDecimal(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function toLocalDateInputValue(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const tzOffsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function todayDateInputValue() {
  return toLocalDateInputValue(new Date());
}

function oneYearLaterMinusOneDay(dateValue) {
  const base = new Date(dateValue || new Date());
  if (Number.isNaN(base.getTime())) return todayDateInputValue();
  const next = new Date(base);
  next.setFullYear(next.getFullYear() + 1);
  next.setDate(next.getDate() - 1);
  return toLocalDateInputValue(next);
}

function formatUiDate(dateValue) {
  if (!dateValue) return '';
  const value = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString();
}

function sanitizeFileName(value) {
  return String(value || 'estimate')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'estimate';
}

function buildMonthlyScheduleRows(contractStartDate, monthCount, amount) {
  const start = new Date(`${contractStartDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const totalMonths = Math.max(1, Math.round(Number(monthCount || 1)));
  return Array.from({ length: totalMonths }, (_, index) => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + index);
    return {
      label: due.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      amount,
    };
  });
}

function hexToRgbTuple(hex, fallback = [47, 111, 156]) {
  const raw = String(hex || '').trim().replace('#', '');
  if (!raw) return fallback;
  const normalized = raw.length === 3
    ? raw.split('').map((char) => `${char}${char}`).join('')
    : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return fallback;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixRgb(base, target, weight = 0.5) {
  return [0, 1, 2].map((index) => {
    const b = Number(base?.[index] ?? 0);
    const t = Number(target?.[index] ?? 0);
    return Math.round(b * (1 - weight) + t * weight);
  });
}

function getContrastRgb(rgb) {
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? [25, 25, 25] : [255, 255, 255];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ── Editable numeric cell ──
   While focused: shows the raw string the user is typing (no formatting).
   On blur: formats with toFixed(digits) and commits value.
   This prevents the "I type 4, it becomes 4.00 and I can't type 40" problem. */
function EditableCell({ value, digits = 2, onChange, onBlur, className = 'cell-input', step = '0.01', readOnly = false }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const displayValue = editing ? draft : Number(value || 0).toFixed(digits);

  return (
    <input
      type="number"
      className={className}
      value={displayValue}
      readOnly={readOnly}
      step={step}
      onFocus={(e) => {
        setEditing(true);
        // Set draft to the current raw numeric value (no trailing zeros during edit)
        const raw = String(value ?? '');
        setDraft(raw);
        // Select all text on focus for easy overwrite
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        // Fire onChange with the raw string so parent can update state
        if (onChange) onChange(e);
      }}
      onBlur={(e) => {
        setEditing(false);
        if (onBlur) onBlur(e);
      }}
    />
  );
}

function createDefaultModel() {
  const defaults = getSettingsDefaults();
  const contractStartDate = todayDateInputValue();
  const contractEndDate = oneYearLaterMinusOneDay(contractStartDate);

  return {
    estimateId: uid('est-v6'),
    estimateNumber: '378',
    estimateTitle: 'Design Build Front Entry',
    locationName: 'Station Place',
    propertyAddress: '1423 Elm Street, Dallas, TX 75201',
    status: 'draft',
    estimatorNotes: '',
    contractTermMonths: normalizePaymentTermMonths(defaults.contractTermMonths),
    minMarginGatePct: defaults.minMarginGatePct,
    netPaymentTerm: DEFAULT_NET_PAYMENT_TERM,
    proposalDate: contractStartDate,
    contractStartDate,
    contractEndDate,
    selectedPropertyId: '',
    customerName: '',
    customerCompany: '',
    customerAddress: '',
    customerEmail: '',
    customerPhone: '',
    laborRates: { ...Object.fromEntries(Object.entries(LABOR_RATES).map(([k, v]) => [k, v.rate])) },
    sections: [
      {
        id: uid('sec'),
        name: 'Plant Install',
        scopeName: 'Plant Installation',
        scopeCollapsed: false,
        collapsed: false,
        complexityPct: 0,
        taxRate: DEFAULT_TAX_RATE,
        frequency: 1,
        items: [
          { id: uid('item'), name: 'Demo Existing Beds', quantity: 14, unit: 'Hr', hours: 14, unitCost: 25, laborCategory: 'planting', gmPct: 68.15, overheadPct: 54.15 },
          { id: uid('item'), name: 'Regrade New Topsoil', quantity: 8, unit: 'Hr', hours: 8, unitCost: 25, laborCategory: 'planting', gmPct: 68.15, overheadPct: 54.15 },
          { id: uid('item'), name: 'Autumn Blaze Maple - Installed 2" B&B', quantity: 7, unit: '2" B&B', hours: 10.5, unitCost: 185, laborCategory: null, gmPct: 59.14, overheadPct: 45.16 },
          { id: uid('item'), name: 'Dwarf Redtwig Dogwood - Installed 5 gal', quantity: 5, unit: '5 gal', hours: 1.5, unitCost: 27.50, laborCategory: null, gmPct: 59.83, overheadPct: 45.76 },
          { id: uid('item'), name: 'Knock Out Rose - Installed 5 gal', quantity: 17, unit: '5 gal', hours: 5.1, unitCost: 29.80, laborCategory: null, gmPct: 59.63, overheadPct: 45.61 },
          { id: uid('item'), name: 'Purple De Oro Daylily - Installed 1 gal', quantity: 35, unit: '1 gal', hours: 3.5, unitCost: 11.50, laborCategory: null, gmPct: 59.28, overheadPct: 45.24 },
        ],
      },
      {
        id: uid('sec'),
        name: 'Hardscape Install',
        scopeName: 'Hardscape Installation',
        scopeCollapsed: false,
        collapsed: false,
        complexityPct: 0,
        taxRate: DEFAULT_TAX_RATE,
        frequency: 1,
        items: [
          { id: uid('item'), name: 'Demo Existing Retaining Wall', quantity: 12, unit: 'Hr', hours: 12, unitCost: 25, laborCategory: 'maintenance', gmPct: 69.29, overheadPct: 55.27 },
          { id: uid('item'), name: 'Demo Existing Patio', quantity: 20, unit: 'Hr', hours: 20, unitCost: 25, laborCategory: 'maintenance', gmPct: 69.29, overheadPct: 55.27 },
          { id: uid('item'), name: 'Patio Installed', quantity: 275, unit: 'sqft', hours: 11, unitCost: 12.80, laborCategory: null, gmPct: 56.35, overheadPct: 42.35 },
        ],
      },
      {
        id: uid('sec'),
        name: 'Irrigation Install',
        scopeName: 'Irrigation Installation',
        scopeCollapsed: false,
        collapsed: false,
        complexityPct: 0,
        taxRate: DEFAULT_TAX_RATE,
        frequency: 12,
        items: [
          { id: uid('item'), name: 'Labor - Irrigation Tech', quantity: 16, unit: 'Hr', hours: 16, unitCost: 35, laborCategory: 'irrigation', gmPct: 68.15, overheadPct: 54.15 },
          { id: uid('item'), name: 'Irrigation Misc Fittings', quantity: 745, unit: 'Dollars', hours: 0, unitCost: 1.00, laborCategory: null, gmPct: 59.05, overheadPct: 45.07 },
        ],
      },
    ],
  };
}

function loadModel() {
  try {
    const defaults = getSettingsDefaults();
    const raw = loadRawModel();
    if (!raw) return createDefaultModel();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sections)) return createDefaultModel();
    return {
      estimateId: uid('est-v6'),
      propertyAddress: '',
      status: 'draft',
      minMarginGatePct: defaults.minMarginGatePct,
      laborRates: { maintenance: 45, planting: 60, irrigation: 75 },
      ...parsed,
      contractTermMonths: normalizePaymentTermMonths(
        parsed.contractTermMonths ?? defaults.contractTermMonths,
      ),
      netPaymentTerm: normalizeNetPaymentTerm(parsed.netPaymentTerm),
      proposalDate: parsed.proposalDate || todayDateInputValue(),
      contractStartDate: parsed.contractStartDate || todayDateInputValue(),
      contractEndDate: parsed.contractEndDate
        || oneYearLaterMinusOneDay(parsed.contractStartDate || todayDateInputValue()),
      selectedPropertyId: parsed.selectedPropertyId || '',
      customerName: parsed.customerName || '',
      customerCompany: parsed.customerCompany || '',
      customerAddress: parsed.customerAddress || parsed.propertyAddress || '',
      customerEmail: parsed.customerEmail || '',
      customerPhone: parsed.customerPhone || '',
      sections: parsed.sections.map((section) => ({
        scopeCollapsed: false,
        frequency: 1,
        ...section,
        // Migrate items that may be missing unitCost (from older data format)
        items: (section.items || []).map((item) => ({
          unitCost: item.unitPrice || 0,   // fallback: use old unitPrice as unitCost
          laborCategory: null,
          ...item,
        })),
      })),
    };
  } catch {
    return createDefaultModel();
  }
}

function computeItem(item, sectionComplexityPct, taxRate, laborRates = {}) {
  const quantity = Math.max(Number(item.quantity || 0), 0);
  const hours = Math.max(Number(item.hours || 0), 0);
  const unitCost = Math.max(Number(item.unitCost || 0), 0);
  const gmPctBase = clamp(Number(item.gmPct || 0), 0, 95);
  const overheadPctBase = Math.max(Number(item.overheadPct || 0), 0);
  const complexityFactor = Math.max(0.1, 1 + (Number(sectionComplexityPct || 0) / 100));
  const laborRate = Math.max(Number(laborRates[item.laborCategory] || 0), 0);
  const useLaborRateAsCost = Boolean(item.laborCategory) && String(item.unit || '').toLowerCase() === 'hr';

  const baseMaterialCost = useLaborRateAsCost ? 0 : quantity * unitCost;
  const baseLaborCost = hours * laborRate;
  const totalCost = (baseMaterialCost + baseLaborCost) * complexityFactor;

  // Selling price derived from cost + desired margin
  const gmFraction = gmPctBase / 100;
  const totalPrice = gmFraction < 1 ? totalCost / (1 - gmFraction) : 0;

  // Unit selling price (for display)
  const unitPrice = quantity > 0 ? totalPrice / quantity : 0;

  // Overhead is a % of cost
  const totalOverhead = totalCost * (overheadPctBase / 100);

  // Tax applies to selling price
  const priceWithTax = totalPrice * (1 + Number(taxRate || DEFAULT_TAX_RATE));

  // Effective GM%
  const gmPct = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

  const totalHours = hours * complexityFactor;

  return {
    ...item,
    quantity,
    hours,
    unitCost,
    laborRate,
    baseMaterialCost,
    baseLaborCost,
    unitPrice,
    totalHours,
    totalPrice,
    totalCost,
    totalOverhead,
    priceWithTax,
    gmPct,
  };
}

function computeSection(section, laborRates = {}) {
  const computedItems = (section.items || []).map((item) =>
    computeItem(item, section.complexityPct, section.taxRate, laborRates),
  );

  const frequency = Math.max(1, Math.round(Number(section.frequency || 1)));

  // Per-visit totals — sum of all items for a single visit
  const perVisit = computedItems.reduce(
    (acc, item) => {
      acc.totalHours += item.totalHours;
      acc.totalPrice += item.totalPrice;
      acc.totalCost += item.totalCost;
      acc.totalOverhead += item.totalOverhead;
      acc.priceWithTax += item.priceWithTax;
      return acc;
    },
    { totalHours: 0, totalPrice: 0, totalCost: 0, totalOverhead: 0, priceWithTax: 0 },
  );

  const perVisitGM = perVisit.totalPrice > 0
    ? ((perVisit.totalPrice - perVisit.totalCost) / perVisit.totalPrice) * 100
    : 0;
  perVisit.grossMarginPct = perVisitGM;

  // Contract-period totals — perVisit × frequency
  const totals = {
    totalHours:    perVisit.totalHours * frequency,
    totalPrice:    perVisit.totalPrice * frequency,
    totalCost:     perVisit.totalCost * frequency,
    totalOverhead: perVisit.totalOverhead * frequency,
    priceWithTax:  perVisit.priceWithTax * frequency,
    grossMarginPct: perVisitGM,   // GM% is a ratio — same regardless of frequency
  };

  return { ...section, computedItems, perVisit, totals, frequency };
}

function buildCustomerName(manager) {
  if (!manager) return '';
  return `${manager.firstName || ''} ${manager.lastName || ''}`.trim();
}

function applyPropertyPrefill(model, property, manager, forceOverwrite = false) {
  if (!property) return model;

  const allowReplace = (currentValue) => forceOverwrite || !String(currentValue || '').trim();
  return {
    ...model,
    selectedPropertyId: property.id || model.selectedPropertyId || '',
    locationName: allowReplace(model.locationName) ? (property.name || model.locationName) : model.locationName,
    propertyAddress: allowReplace(model.propertyAddress) ? (property.address || model.propertyAddress) : model.propertyAddress,
    customerName: allowReplace(model.customerName) ? (buildCustomerName(manager) || model.customerName) : model.customerName,
    customerCompany: allowReplace(model.customerCompany) ? (manager?.companyName || model.customerCompany) : model.customerCompany,
    customerAddress: allowReplace(model.customerAddress) ? (property.address || model.customerAddress) : model.customerAddress,
    customerEmail: allowReplace(model.customerEmail) ? (manager?.email || model.customerEmail) : model.customerEmail,
    customerPhone: allowReplace(model.customerPhone) ? (manager?.phone || model.customerPhone) : model.customerPhone,
  };
}

function createPdfRows(sections) {
  const allRows = [];
  sections.forEach((section) => {
    const frequency = Math.max(1, Math.round(Number(section.frequency || 1)));
    const optionalSection = /optional/i.test(section.name || '') || /optional/i.test(section.scopeName || '');
    section.computedItems.forEach((item) => {
      const costPerOccurrence = Number(item.totalPrice || 0);
      const annualCost = costPerOccurrence * frequency;
      if (costPerOccurrence <= 0 && annualCost <= 0) return;
      allRows.push({
        description: item.name || 'Service',
        frequency,
        costPerOccurrence,
        annualCost,
        optional: optionalSection,
      });
    });
  });

  return {
    fixedRows: allRows.filter((row) => !row.optional),
    optionalRows: allRows.filter((row) => row.optional),
  };
}

function EstimatorV6Sandbox({ properties = [], managers = [], onSaveEstimate }) {
  const [searchParams] = useSearchParams();
  const lastQueryPrefillIdRef = useRef('');
  const [model, setModel] = useState(loadModel);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    // Async sync to Supabase — fire and forget
    import('../../lib/db').then(({ saveEstimatorModel }) => {
      saveEstimatorModel(model).catch((err) => console.warn('Estimator sync to Supabase failed:', err));
    });
  }, [model]);

  // On mount: if Supabase has a saved model, use it (overrides localStorage)
  useEffect(() => {
    import('../../lib/db').then(({ loadEstimatorModel }) => {
      loadEstimatorModel().then((remoteModel) => {
        if (remoteModel && remoteModel.sections) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteModel));
          setModel(remoteModel);
        }
      }).catch(() => {/* fall through to localStorage */});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function syncEstimatorSettings(event) {
      if (event?.key && event.key !== SETTINGS_STORAGE_KEY) return;
      const defaults = getSettingsDefaults();
      setModel((prev) => ({
        ...prev,
        contractTermMonths: normalizePaymentTermMonths(prev.contractTermMonths),
        minMarginGatePct: defaults.minMarginGatePct,
      }));
    }

    window.addEventListener('storage', syncEstimatorSettings);
    window.addEventListener('crm-settings-updated', syncEstimatorSettings);
    return () => {
      window.removeEventListener('storage', syncEstimatorSettings);
      window.removeEventListener('crm-settings-updated', syncEstimatorSettings);
    };
  }, []);

  useEffect(() => {
    const propertyIdFromQuery = searchParams.get('propertyId');
    if (!propertyIdFromQuery) {
      lastQueryPrefillIdRef.current = '';
      return;
    }
    if (lastQueryPrefillIdRef.current === propertyIdFromQuery) return;
    const property = properties.find((item) => item.id === propertyIdFromQuery);
    if (!property) return;
    const manager = managers.find((item) => item.id === property.propertyManagerId);
    lastQueryPrefillIdRef.current = propertyIdFromQuery;
    setModel((prev) => {
      if (prev.selectedPropertyId === propertyIdFromQuery) return prev;
      return applyPropertyPrefill(prev, property, manager, true);
    });
  }, [searchParams, properties, managers]);

  const sections = useMemo(
    () => (model.sections || []).map((section) => computeSection(section, model.laborRates || {})),
    [model.sections, model.laborRates],
  );

  const selectedProperty = useMemo(
    () => properties.find((item) => item.id === model.selectedPropertyId) || null,
    [properties, model.selectedPropertyId],
  );

  const selectedManager = useMemo(
    () => managers.find((item) => item.id === selectedProperty?.propertyManagerId) || null,
    [managers, selectedProperty],
  );

  const summary = useMemo(() => {
    const totals = sections.reduce(
      (acc, section) => {
        acc.totalPrice += section.totals.totalPrice;
        acc.totalOverhead += section.totals.totalOverhead;
        acc.totalCost += section.totals.totalCost;
        acc.totalWithTax += section.totals.priceWithTax;
        return acc;
      },
      { totalPrice: 0, totalOverhead: 0, totalCost: 0, totalWithTax: 0 },
    );
    const grossMarginPct = totals.totalPrice > 0
      ? ((totals.totalPrice - totals.totalCost) / totals.totalPrice) * 100
      : 0;
    const netProfitPct = totals.totalPrice > 0
      ? ((totals.totalPrice - totals.totalCost - totals.totalOverhead) / totals.totalPrice) * 100
      : 0;
    const contractTermMonths = normalizePaymentTermMonths(model.contractTermMonths);
    const minMarginGatePct = Math.max(0, Number(model.minMarginGatePct || DEFAULT_MARGIN_GATE_PCT));
    const monthlyPaymentWithTax = totals.totalWithTax / contractTermMonths;
    const marginBlocked = grossMarginPct < minMarginGatePct;
    const netPaymentTerm = normalizeNetPaymentTerm(model.netPaymentTerm);
    return {
      ...totals,
      grossMarginPct,
      netProfitPct,
      contractTermMonths,
      minMarginGatePct,
      monthlyPaymentWithTax,
      netPaymentTerm,
      marginBlocked,
    };
  }, [sections, model.contractTermMonths, model.minMarginGatePct, model.netPaymentTerm]);

  const monthlySchedulePreview = useMemo(() => {
    if (summary.contractTermMonths !== 12) return [];
    const start = model.contractStartDate || todayDateInputValue();
    return buildMonthlyScheduleRows(
      start,
      12,
      summary.totalWithTax / 12,
    );
  }, [summary.contractTermMonths, summary.totalWithTax, model.contractStartDate]);

  function updateModel(updater) {
    setModel((prev) => updater(prev));
  }

  function updateSection(sectionId, updates) {
    updateModel((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section),
    }));
  }

  function updateItem(sectionId, itemId, updates) {
    updateModel((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          items: section.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item),
        };
      }),
    }));
  }

  function addItem(sectionId) {
    const newItem = {
      id: uid('item'),
      name: 'New Estimate Item',
      quantity: 1,
      unit: 'Hr',
      hours: 1,
      unitCost: 25,
      laborCategory: 'maintenance',
      gmPct: 60,
      overheadPct: 40,
    };
    updateModel((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => (
        section.id === sectionId ? { ...section, items: [...section.items, newItem] } : section
      )),
    }));
  }

  function removeItem(sectionId, itemId) {
    updateModel((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          items: section.items.filter((item) => item.id !== itemId),
        };
      }),
    }));
  }

  function addSection() {
    const newSection = {
      id: uid('sec'),
      name: 'New Section',
      scopeName: 'New Scope',
      scopeCollapsed: false,
      collapsed: false,
      complexityPct: 0,
      taxRate: DEFAULT_TAX_RATE,
      frequency: 1,
      items: [],
    };
    updateModel((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));
  }

  // ── Catalog Import ───────────────────────────────────────────────────────────
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogSel, setCatalogSel] = useState(new Set());
  const [catalogSectionName, setCatalogSectionName] = useState('');
  const [catalogFrequency, setCatalogFrequency] = useState(1);

  function openCatalog() {
    try {
      const raw = localStorage.getItem('tsos-catalog-items-v1');
      const parsed = raw ? JSON.parse(raw) : [];
      setCatalogItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCatalogItems([]);
    }
    setCatalogSel(new Set());
    setCatalogSectionName('');
    setCatalogFrequency(1);
    setShowCatalog(true);
  }

  function toggleCatalogItem(itemId) {
    setCatalogSel((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function insertFromCatalog() {
    if (catalogSel.size === 0) return;
    const selected = catalogItems.filter((item) => catalogSel.has(item.id));
    const newSection = {
      id: uid('sec'),
      name: catalogSectionName || 'Catalog Section',
      scopeName: catalogSectionName || 'Catalog Section',
      scopeCollapsed: false,
      collapsed: false,
      complexityPct: 0,
      taxRate: DEFAULT_TAX_RATE,
      frequency: Math.max(1, Number(catalogFrequency) || 1),
      items: selected.map((item) => ({
        id: uid('item'),
        name: item.name || 'Item',
        quantity: Number(item.defaultQty) || 1,
        unit: item.unit || 'ea',
        hours: Number(item.defaultHours) || 0,
        unitCost: Number(item.defaultUnitCost) || 0,
        laborCategory: item.laborCategory || null,
        gmPct: Number(item.defaultGmPct) || 55,
        overheadPct: Number(item.defaultOverheadPct) || 40,
      })),
    };
    updateModel((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));
    setShowCatalog(false);
  }

  const catalogByTrade = useMemo(() => {
    const groups = {};
    catalogItems.forEach((item) => {
      const trade = item.trade || 'general';
      if (!groups[trade]) groups[trade] = [];
      groups[trade].push(item);
    });
    return groups;
  }, [catalogItems]);

  function updateItemFromFormula(sectionId, itemId, field, rawValue) {
    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) return;

    updateModel((prev) => {
      const sectionsNext = prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const complexityFactor = Math.max(0.1, 1 + (Number(section.complexityPct || 0) / 100));
        const taxRate = Number(section.taxRate || DEFAULT_TAX_RATE);
        return {
          ...section,
          items: section.items.map((item) => {
            if (item.id !== itemId) return item;
            const quantity = Math.max(Number(item.quantity || 0), 0);
            const hours = Math.max(Number(item.hours || 0), 0);
            const currentUnitCost = Math.max(Number(item.unitCost || 0), 0);
            const laborRate = Math.max(Number(prev.laborRates?.[item.laborCategory] || 0), 0);
            const useLaborRateAsCost = Boolean(item.laborCategory) && String(item.unit || '').toLowerCase() === 'hr';
            const baseMaterialCost = useLaborRateAsCost ? 0 : quantity * currentUnitCost;
            const baseLaborCost = hours * laborRate;
            const currentCost = (baseMaterialCost + baseLaborCost) * complexityFactor;
            const next = { ...item };

            if (field === 'totalPrice') {
              // User changed selling price → back-solve GM%
              if (value > 0 && currentCost > 0) {
                next.gmPct = clamp((1 - currentCost / value) * 100, 0, 95);
              }
            }
            if (field === 'totalCost') {
              // User changed cost → back-solve the editable anchor(s)
              if (complexityFactor > 0) {
                const normalizedCost = value / complexityFactor;
                if (useLaborRateAsCost) {
                  if (laborRate > 0) {
                    const nextHours = normalizedCost / laborRate;
                    next.hours = nextHours;
                    if (String(item.unit || '').toLowerCase() === 'hr') {
                      next.quantity = nextHours;
                    }
                  }
                } else if (quantity > 0) {
                  const materialOnlyCost = Math.max(normalizedCost - baseLaborCost, 0);
                  next.unitCost = materialOnlyCost / quantity;
                }
              }
            }
            if (field === 'totalOverhead') {
              // totalOverhead = totalCost * (overheadPct / 100)
              if (currentCost > 0) {
                next.overheadPct = (value / currentCost) * 100;
              }
            }
            if (field === 'priceWithTax') {
              // back-solve GM% from implied totalPrice
              const impliedTotalPrice = value / (1 + taxRate);
              if (impliedTotalPrice > 0 && currentCost > 0) {
                next.gmPct = clamp((1 - currentCost / impliedTotalPrice) * 100, 0, 95);
              }
            }
            if (field === 'gmPct') {
              next.gmPct = clamp(value, 0, 95);
            }
            return next;
          }),
        };
      });
      return { ...prev, sections: sectionsNext };
    });
  }

  function updateLaborRate(category, newRate) {
    updateModel((prev) => ({
      ...prev,
      laborRates: { ...prev.laborRates, [category]: parseFloat(newRate) || 0 },
    }));
  }

  function handleSelectProperty(propertyId) {
    if (!propertyId) {
      updateModel((prev) => ({ ...prev, selectedPropertyId: '' }));
      return;
    }
    const property = properties.find((item) => item.id === propertyId);
    const manager = managers.find((item) => item.id === property?.propertyManagerId);
    updateModel((prev) => applyPropertyPrefill(prev, property, manager, true));
  }

  async function handleDownloadPdf() {
    const { fixedRows, optionalRows } = createPdfRows(sections);
    const annualMaintenancePrice = fixedRows.reduce((sum, row) => sum + row.annualCost, 0);

    if (fixedRows.length === 0 && optionalRows.length === 0) {
      alert('Add at least one priced line item before downloading a PDF.');
      return;
    }

    const settings = loadSettings();

    // Resolve logo: use uploaded logo → brand SVG → text fallback
    let resolvedLogoDataUrl = settings.logoDataUrl && settings.logoDataUrl.startsWith('data:image/')
      ? settings.logoDataUrl
      : null;
    if (!resolvedLogoDataUrl) {
      try {
        resolvedLogoDataUrl = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(null);
          img.src = '/logo.svg';
        });
      } catch {
        resolvedLogoDataUrl = null;
      }
    }

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const primaryRgb = hexToRgbTuple(settings.primaryColor, [47, 111, 156]);
    const secondaryRgb = hexToRgbTuple(settings.secondaryColor, [39, 88, 124]);
    const headerBg = mixRgb(primaryRgb, [255, 255, 255], 0.92);
    const cardBg = mixRgb(primaryRgb, [255, 255, 255], 0.96);
    const mutedBorder = mixRgb(secondaryRgb, [255, 255, 255], 0.75);
    const bandTextRgb = getContrastRgb(secondaryRgb);
    const tableAltBg = mixRgb(primaryRgb, [255, 255, 255], 0.975);

    const proposalDate = model.proposalDate || todayDateInputValue();
    const contractStartDate = model.contractStartDate || todayDateInputValue();
    const contractEndDate = model.contractEndDate || oneYearLaterMinusOneDay(contractStartDate);
    const agreementYear = Number.parseInt(contractStartDate.slice(0, 4), 10) || new Date().getFullYear();

    doc.setFillColor(...headerBg);
    doc.rect(0, 0, pageWidth, 78, 'F');
    doc.setDrawColor(...mutedBorder);
    doc.line(margin, 78, pageWidth - margin, 78);

    const logoWidth = 150;
    const logoHeight = 40;
    try {
      if (resolvedLogoDataUrl) {
        doc.addImage(resolvedLogoDataUrl, 'PNG', margin, 28, logoWidth, logoHeight);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...primaryRgb);
        doc.text(settings.businessName || 'Landscape Development', margin, 48);
        doc.setTextColor(0, 0, 0);
      }
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...primaryRgb);
      doc.text(settings.businessName || 'Landscape Development', margin, 48);
      doc.setTextColor(0, 0, 0);
    }

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...mutedBorder);
    doc.roundedRect(pageWidth - 240, 22, 204, 56, 4, 4, 'FD');
    doc.setFillColor(...secondaryRgb);
    doc.roundedRect(pageWidth - 240, 22, 204, 20, 4, 4, 'F');
    doc.setTextColor(...bandTextRgb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Proposal #${model.estimateNumber || ''}`, pageWidth - 138, 36, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Date', pageWidth - 226, 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(formatUiDate(proposalDate), pageWidth - 184, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Net Terms', pageWidth - 226, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(netPaymentTermLabel(summary.netPaymentTerm), pageWidth - 170, 70);

    const boxTop = 96;
    const boxGap = 16;
    const boxWidth = (pageWidth - margin * 2 - boxGap) / 2;
    const bodyHeight = 92;
    const titleHeight = 18;

    const drawInfoBox = (x, y, title, lines) => {
      doc.setFillColor(...secondaryRgb);
      doc.rect(x, y, boxWidth, titleHeight, 'F');
      doc.setTextColor(...bandTextRgb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${title}:`, x + 8, y + 12.5);
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(...mutedBorder);
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y + titleHeight, boxWidth, bodyHeight, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let cursorY = y + titleHeight + 14;
      lines.forEach((line) => {
        if (!line) return;
        const wrapped = doc.splitTextToSize(String(line), boxWidth - 12);
        wrapped.forEach((wrapLine) => {
          doc.text(wrapLine, x + 6, cursorY);
          cursorY += 12;
        });
      });
    };

    drawInfoBox(margin, boxTop, 'Customer', [
      model.customerName || buildCustomerName(selectedManager),
      model.customerCompany || selectedManager?.companyName || '',
      model.customerAddress || model.propertyAddress || selectedProperty?.address || '',
    ]);
    drawInfoBox(margin + boxWidth + boxGap, boxTop, 'Property', [
      model.locationName || selectedProperty?.name || '',
      model.propertyAddress || selectedProperty?.address || '',
    ]);

    const agreementTop = boxTop + bodyHeight + titleHeight + 18;
    doc.setFillColor(...secondaryRgb);
    doc.rect(margin, agreementTop, pageWidth - margin * 2, 22, 'F');
    doc.setTextColor(...bandTextRgb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Landscape Maintenance Agreement ${agreementYear}`, pageWidth / 2, agreementTop + 15, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const agreementText = `This agreement is for a one (1) year period, beginning ${formatUiDate(contractStartDate)} and ending ${formatUiDate(contractEndDate)} and shall be automatically renewed for successive equal periods unless terminated by either party by not less than thirty (30) days written notice prior to the end of the specified period.`;
    const wrappedAgreement = doc.splitTextToSize(agreementText, pageWidth - margin * 2);
    doc.text(wrappedAgreement, margin, agreementTop + 36);

    let cursorY = agreementTop + 36 + wrappedAgreement.length * 12 + 14;
    const footerReservedHeight = 44;
    const tableStyles = {
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, lineColor: mutedBorder, lineWidth: 0.2, cellPadding: 4 },
      headStyles: { fillColor: secondaryRgb, textColor: bandTextRgb, halign: 'left', fontStyle: 'bold' },
      alternateRowStyles: { fillColor: tableAltBg },
      tableLineWidth: 0.2,
      tableLineColor: mutedBorder,
    };

    const drawContinuationHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryRgb);
      doc.text(`Proposal #${model.estimateNumber || ''} - Continued`, margin, margin - 4);
      doc.setDrawColor(...mutedBorder);
      doc.line(margin, margin, pageWidth - margin, margin);
      doc.setTextColor(0, 0, 0);
    };

    const ensurePageSpace = (requiredHeight = 24) => {
      if (cursorY + requiredHeight <= pageHeight - footerReservedHeight) return;
      doc.addPage();
      drawContinuationHeader();
      cursorY = margin + 14;
    };

    const drawBandHeading = (title) => {
      ensurePageSpace(24);
      doc.setFillColor(...secondaryRgb);
      doc.rect(margin, cursorY, pageWidth - margin * 2, 18, 'F');
      doc.setTextColor(...bandTextRgb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, margin + 8, cursorY + 12.5);
      doc.setTextColor(0, 0, 0);
      cursorY += 22;
    };

    drawBandHeading('Fixed Payment Services');
    autoTable(doc, {
      startY: cursorY,
      head: [['Description of Services', 'Frequency', 'Cost per Occ.', 'Annual Cost']],
      body: fixedRows.map((row) => ([
        row.description,
        String(row.frequency),
        formatCurrency(row.costPerOccurrence),
        formatCurrency(row.annualCost),
      ])),
      ...tableStyles,
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;

    ensurePageSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setDrawColor(...mutedBorder);
    doc.line(margin, cursorY - 8, pageWidth - margin, cursorY - 8);
    doc.text('Annual Maintenance Price', margin, cursorY + 4);
    doc.text(formatCurrency(annualMaintenancePrice), pageWidth - margin, cursorY + 4, { align: 'right' });
    cursorY += 20;

    ensurePageSpace(58);
    const statCardGap = 8;
    const statCardWidth = (pageWidth - margin * 2 - statCardGap * 2) / 3;
    const statCards = [
      { label: 'Annual Maintenance', value: formatCurrency(annualMaintenancePrice) },
      { label: 'Payment Term', value: `${summary.contractTermMonths} months` },
      { label: 'Per-Month Billing', value: formatCurrency(summary.monthlyPaymentWithTax) },
    ];
    statCards.forEach((card, index) => {
      const x = margin + index * (statCardWidth + statCardGap);
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...mutedBorder);
      doc.roundedRect(x, cursorY, statCardWidth, 46, 3, 3, 'FD');
      doc.setFillColor(...primaryRgb);
      doc.rect(x, cursorY, statCardWidth, 3, 'F');
      doc.setTextColor(...secondaryRgb);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(card.label, x + 8, cursorY + 15);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(card.value, x + 8, cursorY + 31);
    });
    cursorY += 58;

    if (optionalRows.length > 0) {
      drawBandHeading('Optional Services');
      autoTable(doc, {
        startY: cursorY,
        head: [['Description of Services', 'Frequency', 'Cost per Occ.', 'Annual Cost']],
        body: optionalRows.map((row) => ([
          row.description,
          String(row.frequency),
          formatCurrency(row.costPerOccurrence),
          formatCurrency(row.annualCost),
        ])),
        ...tableStyles,
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
      });
      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;
    }

    if (summary.contractTermMonths === 12 && summary.totalWithTax > 0) {
      const monthlyRows = buildMonthlyScheduleRows(
        contractStartDate,
        12,
        summary.totalWithTax / 12,
      );
      if (monthlyRows.length > 0) {
        drawBandHeading('Monthly Payment Schedule');
        autoTable(doc, {
          startY: cursorY,
          head: [['Month', 'Payment']],
          body: monthlyRows.map((row) => [row.label, formatCurrency(row.amount)]),
          ...tableStyles,
          columnStyles: {
            1: { halign: 'right' },
          },
        });
        cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;
      }
    }

    const termsText = String(settings.termsAndConditions || '').trim();
    if (termsText) {
      drawBandHeading('Terms & Conditions');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const paragraphRows = termsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      paragraphRows.forEach((paragraph) => {
        const wrapped = doc.splitTextToSize(paragraph, pageWidth - margin * 2);
        wrapped.forEach((line) => {
          ensurePageSpace(14);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(line, margin, cursorY);
          cursorY += 12;
        });
        cursorY += 6;
      });
    }

    const totalPages = doc.getNumberOfPages();
    const footerLeft = settings.businessAddress
      ? `${settings.businessName || 'True Star Outdoor Solutions'} • ${settings.businessAddress}`
      : (settings.businessName || 'True Star Outdoor Solutions');
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(footerLeft, margin, pageHeight - 18);
      doc.text(`Page ${pageNumber}/${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
    }

    const fileName = `${sanitizeFileName(model.locationName || 'property')}-proposal-${sanitizeFileName(model.estimateNumber || 'estimate')}.pdf`;
    doc.save(fileName);
  }

  function handleApproveEstimate() {
    if (model.status === 'approved') return;
    if (summary.marginBlocked) {
      alert(`Gross margin is below the ${summary.minMarginGatePct.toFixed(2)}% gate. Adjust pricing or lower the gate in Settings.`);
      return;
    }

    // Check for existing tickets with same estimateId (prevent duplicates)
    const existingTickets = loadTickets();
    if (existingTickets.some((t) => t.estimateId === model.estimateId)) {
      alert('Tickets have already been generated for this estimate.');
      return;
    }

    // Generate work tickets — one per frequency per section
    const newTickets = [];
    const now = new Date().toISOString();

    sections.forEach((section) => {
      const freq = Math.max(1, Math.round(Number(section.frequency || 1)));
      // Build work description from items
      const workDescription = section.computedItems
        .map((item) => `${item.name} (${item.quantity} ${item.unit || ''})`)
        .join(', ');

      for (let seq = 1; seq <= freq; seq++) {
        newTickets.push({
          id: uid('tkt'),
          estimateId: model.estimateId,
          sectionId: section.id,
          sectionName: section.name,
          sequenceNumber: seq,
          totalVisits: freq,
          propertyName: model.locationName || '',
          propertyAddress: model.propertyAddress || '',
          scopeOfWork: section.scopeName || section.name,
          workDescription,
          estimatedHours: section.perVisit.totalHours,
          estimatedPrice: section.perVisit.totalPrice,
          crewId: null,
          scheduledDate: null,
          status: 'unscheduled',
          notes: '',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    // Write all tickets to localStorage
    const allTickets = [...existingTickets, ...newTickets];
    saveTickets(allTickets);

    // Set estimate status to approved
    updateModel((prev) => ({ ...prev, status: 'approved' }));

    // Persist estimate to Supabase estimates table so it appears in the list
    if (onSaveEstimate) {
      const { fixedRows, optionalRows } = createPdfRows(sections);
      const subtotalFixed = fixedRows.reduce((s, r) => s + r.annualCost, 0);
      const subtotalOptional = optionalRows.reduce((s, r) => s + r.annualCost, 0);
      const annualTotal = subtotalFixed + subtotalOptional;
      const salesTax = annualTotal * (sections[0]?.taxRate ?? DEFAULT_TAX_RATE);
      onSaveEstimate({
        id: model.estimateId,
        proposalNumber: model.estimateNumber || '',
        propertyId: model.selectedPropertyId || null,
        propertyManagerId: null,
        status: 'approved',
        contractStartDate: model.contractStartDate || null,
        contractEndDate: model.contractEndDate || null,
        services: sections.map((s) => ({ id: s.id, name: s.name, scopeName: s.scopeName })),
        subtotalFixed,
        subtotalOptional,
        annualTotal,
        salesTax,
        totalWithTax: annualTotal + salesTax,
        locationName: model.locationName || '',
        customerName: model.customerName || '',
        estimateTitle: model.estimateTitle || '',
        createdAt: new Date().toISOString(),
      });
    }

    alert(`✅ ${newTickets.length} work tickets generated!`);
  }

  return (
    <div className="v5-shell">
      <header className="v5-top-bar">
        <div className="v5-opportunities">Opportunities</div>
        <div className="v5-breadcrumbs">
          <span className="v5-tab">OPPORTUNITY #{model.estimateNumber}</span>
          <span className="v5-tab active">ESTIMATE</span>
        </div>
      </header>

      <section className="v5-title-row">
        <h1>
          Estimate #{model.estimateNumber}
          {' '}
          <input
            className="v5-title-input"
            value={model.estimateTitle}
            onChange={(e) => updateModel((prev) => ({ ...prev, estimateTitle: e.target.value }))}
          />
          <span className="v5-location">
            <input
              className="v5-location-input"
              value={model.locationName}
              onChange={(e) => updateModel((prev) => ({ ...prev, locationName: e.target.value }))}
            />
          </span>
        </h1>
        <div className="property-address-row">
          <span className="property-address-label">Property Link:</span>
          <select
            className="property-selector"
            value={model.selectedPropertyId || ''}
            onChange={(e) => handleSelectProperty(e.target.value)}
          >
            <option value="">Manual (not linked)</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>
        </div>
        <div className="property-address-row">
          <span className="property-address-label">Property:</span>
          <input
            className="property-address-input"
            value={model.propertyAddress || ''}
            onChange={(e) => updateModel((prev) => ({ ...prev, propertyAddress: e.target.value }))}
            placeholder="Enter property address..."
          />
        </div>
        <div className="client-details-grid">
          <label>
            Customer Name
            <input
              value={model.customerName || ''}
              onChange={(e) => updateModel((prev) => ({ ...prev, customerName: e.target.value }))}
              placeholder="Client contact name"
            />
          </label>
          <label>
            Company
            <input
              value={model.customerCompany || ''}
              onChange={(e) => updateModel((prev) => ({ ...prev, customerCompany: e.target.value }))}
              placeholder="Client company"
            />
          </label>
          <label>
            Email
            <input
              value={model.customerEmail || ''}
              onChange={(e) => updateModel((prev) => ({ ...prev, customerEmail: e.target.value }))}
              placeholder="contact@email.com"
            />
          </label>
          <label>
            Phone
            <input
              value={model.customerPhone || ''}
              onChange={(e) => updateModel((prev) => ({ ...prev, customerPhone: e.target.value }))}
              placeholder="(555) 555-5555"
            />
          </label>
        </div>
        <div className="property-address-row">
          <span className="property-address-label">Customer Address:</span>
          <input
            className="property-address-input"
            value={model.customerAddress || ''}
            onChange={(e) => updateModel((prev) => ({ ...prev, customerAddress: e.target.value }))}
            placeholder="Customer mailing address..."
          />
        </div>

        {/* Labor rate catalog */}
        <div className="labor-rates-bar">
          <span className="labor-rates-label">Labor Rates:</span>
          {Object.entries(LABOR_RATES).map(([key, { label }]) => (
            <div key={key} className="labor-rate-chip">
              <span>{label}</span>
              <span>$</span>
              <input
                type="number"
                value={model.laborRates?.[key] ?? LABOR_RATES[key].rate}
                onChange={(e) => updateLaborRate(key, e.target.value)}
                step="0.01"
              />
              <span>/hr</span>
            </div>
          ))}
        </div>
      </section>

      <div className="v5-layout">
        <div className="v5-grid-wrap">
          <table className="v5-grid">
            <colgroup>
              <col className="cg-grip" />
              <col className="cg-add" />
              <col className="cg-expand" />
              <col className="cg-service" />
              <col className="cg-qty" />
              <col className="cg-complex" />
              <col className="cg-hours" />
              <col className="cg-ucost" />
              <col className="cg-uprice" />
              <col className="cg-tprice" />
              <col className="cg-gm" />
              <col className="cg-oh" />
              <col className="cg-tcost" />
              <col className="cg-tax" />
              <col className="cg-menu" />
            </colgroup>
            <thead>
              <tr className="v5-header-super">
                <th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th>
                <th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th>
                <th className="right super-total" colSpan={3}>TOTAL</th>
                <th>&nbsp;</th>
              </tr>
              <tr className="v5-header-main">
                <th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th>
                <th className="right">Qty</th>
                <th className="right">Cplx</th>
                <th className="right">Hrs</th>
                <th className="right">UCost</th>
                <th className="right">Unit&nbsp;$</th>
                <th className="right">Total&nbsp;$</th>
                <th className="right">GM%</th>
                <th className="right">OH&nbsp;$</th>
                <th className="right">Cost</th>
                <th className="right">w/Tax</th>
                <th>&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <React.Fragment key={section.id}>
                  {/* Section header row */}
                  <tr className="v5-section-row">
                    <td className="col-grip"><GripVertical size={12} /></td>
                    <td className="col-add">
                      <button type="button" className="icon-btn" onClick={() => addItem(section.id)}>
                        <PlusCircle size={14} />
                      </button>
                    </td>
                    <td className="col-expand">
                      <button type="button" className="icon-btn"
                        onClick={() => updateSection(section.id, { collapsed: !section.collapsed })}>
                        {section.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </td>
                    <td colSpan={5} className="section-title-cell">
                      <span className="section-title-text">{section.name}</span>
                      <FileText size={12} className="section-doc-icon" />
                    </td>
                    <td className="right">
                      {section.frequency > 1 && (
                        <span className="frequency-badge">×{section.frequency}</span>
                      )}
                    </td>
                    <td className="right strong">{formatCurrency(section.totals.totalPrice)}</td>
                    <td className="right strong">{formatPercent(section.totals.grossMarginPct)}</td>
                    <td className="right strong">{formatCurrency(section.totals.totalOverhead)}</td>
                    <td className="right strong">{formatCurrency(section.totals.totalCost)}</td>
                    <td className="right strong">{formatCurrency(section.totals.priceWithTax)}</td>
                    <td className="col-menu">
                      <button type="button" className="icon-btn"><MoreVertical size={12} /></button>
                    </td>
                  </tr>

                  {!section.collapsed && (
                    <>
                      {/* Scope row */}
                      <tr className="v5-scope-row">
                        <td className="col-grip"><GripVertical size={10} /></td>
                        <td className="col-add">
                          <button type="button" className="icon-btn" onClick={() => addItem(section.id)}>
                            <PlusCircle size={12} />
                          </button>
                        </td>
                        <td className="col-expand">
                          <button type="button" className="icon-btn"
                            onClick={() => updateSection(section.id, { scopeCollapsed: !section.scopeCollapsed })}>
                            {section.scopeCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                        <td className="scope-name-cell">
                          <input className="scope-name-input" value={section.scopeName}
                            onChange={(e) => updateSection(section.id, { scopeName: e.target.value })} />
                        </td>
                        <td className="right">
                          <EditableCell
                            value={section.frequency}
                            digits={0}
                            step="1"
                            className="cell-input frequency-input"
                            onChange={(e) => {
                              const val = Math.max(1, Math.round(parseFloat(e.target.value) || 1));
                              updateSection(section.id, { frequency: val });
                            }}
                          />
                        </td>
                        <td className="right">
                          <div className="complexity-control">
                            <button type="button"
                              onClick={() => updateSection(section.id, { complexityPct: Number(section.complexityPct || 0) - 1 })}>-</button>
                            <EditableCell value={section.complexityPct || 0} digits={0}
                              onChange={(e) => updateSection(section.id, { complexityPct: parseFloat(e.target.value) || 0 })}
                            />
                            <span>%</span>
                            <button type="button"
                              onClick={() => updateSection(section.id, { complexityPct: Number(section.complexityPct || 0) + 1 })}>+</button>
                          </div>
                        </td>
                        <td className="right">{formatDecimal(section.totals.totalHours)}</td>
                        <td className="right">&nbsp;</td>
                        <td className="right">&nbsp;</td>
                        <td className="right">
                          <EditableCell
                            value={section.totals.totalPrice}
                            onChange={(e) => {
                              const costSum = section.totals.totalCost;
                              if (costSum <= 0) return;
                              const targetPrice = parseFloat(e.target.value) || 1;
                              const newGm = clamp((1 - costSum / targetPrice) * 100, 0, 95);
                              updateModel((prev) => ({
                                ...prev,
                                sections: prev.sections.map((s) =>
                                  s.id === section.id
                                    ? { ...s, items: s.items.map((i) => ({ ...i, gmPct: newGm })) }
                                    : s,
                                ),
                              }));
                            }}
                          />
                        </td>
                        <td className="right">{formatPercent(section.totals.grossMarginPct)}</td>
                        <td className="right">{formatCurrency(section.totals.totalOverhead)}</td>
                        <td className="right">{formatCurrency(section.totals.totalCost)}</td>
                        <td className="right">{formatCurrency(section.totals.priceWithTax)}</td>
                        <td className="col-menu">
                          <button type="button" className="icon-btn"><MoreVertical size={12} /></button>
                        </td>
                      </tr>

                      {/* Item rows */}
                      {!section.scopeCollapsed && section.computedItems.map((item) => (
                        <tr key={item.id} className="v5-item-row">
                          <td className="col-grip"><GripVertical size={10} /></td>
                          <td className="col-add">&nbsp;</td>
                          <td className="col-expand">&nbsp;</td>
                          <td className="item-name-cell">
                            <input className="item-name-input" value={item.name}
                              onChange={(e) => updateItem(section.id, item.id, { name: e.target.value })} />
                          </td>
                          <td className="right">
                            <div className="qty-control">
                              <EditableCell value={item.quantity} digits={2}
                                onChange={(e) => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                              />
                              <input className="unit-input" value={item.unit || ''}
                                onChange={(e) => updateItem(section.id, item.id, { unit: e.target.value })} />
                            </div>
                          </td>
                          <td className="right">&nbsp;</td>
                          <td className="right">
                            <EditableCell value={item.hours} digits={2}
                              onChange={(e) => updateItem(section.id, item.id, { hours: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          {/* Unit Cost — editable */}
                          <td className="right">
                            <EditableCell value={item.unitCost} digits={2}
                              onChange={(e) => updateItem(section.id, item.id, { unitCost: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          {/* Unit $ — computed selling price per unit (read-only display) */}
                          <td className="right">{formatDecimal(item.unitPrice, 2)}</td>
                          {/* Total $ — editable, back-solves GM% */}
                          <td className="right">
                            <EditableCell value={item.totalPrice} digits={2}
                              onChange={(e) => updateItemFromFormula(section.id, item.id, 'totalPrice', e.target.value)}
                            />
                          </td>
                          {/* GM% — editable, changes Total $ and w/Tax */}
                          <td className="right">
                            <EditableCell value={item.gmPct} digits={2}
                              onChange={(e) => updateItemFromFormula(section.id, item.id, 'gmPct', e.target.value)}
                            />
                          </td>
                          {/* OH $ — editable */}
                          <td className="right">
                            <EditableCell value={item.totalOverhead} digits={2}
                              onChange={(e) => updateItemFromFormula(section.id, item.id, 'totalOverhead', e.target.value)}
                            />
                          </td>
                          {/* Cost — editable, back-solves unitCost */}
                          <td className="right">
                            <EditableCell value={item.totalCost} digits={2}
                              onChange={(e) => updateItemFromFormula(section.id, item.id, 'totalCost', e.target.value)}
                            />
                          </td>
                          {/* w/ Tax — editable, back-solves GM% */}
                          <td className="right">
                            <EditableCell value={item.priceWithTax} digits={2}
                              onChange={(e) => updateItemFromFormula(section.id, item.id, 'priceWithTax', e.target.value)}
                            />
                          </td>
                          <td className="col-menu">
                            <button type="button" className="icon-btn danger" onClick={() => removeItem(section.id, item.id)}>
                              <MoreVertical size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Add item row */}
                      {!section.scopeCollapsed && (
                      <tr className="v5-add-row">
                        <td className="col-grip">&nbsp;</td><td className="col-add">&nbsp;</td><td className="col-expand">&nbsp;</td>
                        <td colSpan={12}>
                          <button type="button" className="add-item-btn" onClick={() => addItem(section.id)}>
                            Add an Item
                            <ChevronDown size={14} />
                          </button>
                        </td>
                      </tr>
                      )}
                    </>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <div className="v5-grid-actions">
            <button type="button" className="add-section-btn" onClick={addSection}>
              <Plus size={14} />
              Add Section
            </button>
            <button type="button" className="add-section-btn" onClick={openCatalog}>
              <PlusCircle size={14} />
              From Catalog
            </button>
          </div>

          {showCatalog && (
            <div className="catalog-drawer">
              <div className="catalog-drawer-header">
                <h3>Insert from Service Catalog</h3>
                <button type="button" className="ghost" onClick={() => setShowCatalog(false)}>✕ Close</button>
              </div>
              <div className="catalog-drawer-config">
                <label>
                  Section Name
                  <input
                    type="text"
                    value={catalogSectionName}
                    onChange={(e) => setCatalogSectionName(e.target.value)}
                    placeholder="e.g. Turf Maintenance"
                  />
                </label>
                <label>
                  Visits/Year
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={catalogFrequency}
                    onChange={(e) => setCatalogFrequency(Number(e.target.value) || 1)}
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={insertFromCatalog}
                  disabled={catalogSel.size === 0}
                >
                  Insert {catalogSel.size > 0 ? `(${catalogSel.size})` : ''} as Section
                </button>
              </div>
              <div className="catalog-drawer-body">
                {Object.entries(catalogByTrade).map(([trade, items]) => (
                  <div key={trade} className="catalog-trade-group">
                    <div className="catalog-trade-label">{trade.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                    {items.map((item) => (
                      <label key={item.id} className={`catalog-item-row${catalogSel.has(item.id) ? ' selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={catalogSel.has(item.id)}
                          onChange={() => toggleCatalogItem(item.id)}
                        />
                        <span className="catalog-item-name">{item.name}</span>
                        <span className="catalog-item-meta">
                          {item.defaultQty > 0 ? `${item.defaultQty} ${item.unit || 'ea'}` : ''}
                          {item.defaultHours > 0 ? ` · ${item.defaultHours}h` : ''}
                          {item.defaultUnitCost > 0 ? ` · $${Number(item.defaultUnitCost).toFixed(2)}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
                {catalogItems.length === 0 && (
                  <p style={{ color: 'var(--muted)', padding: 16 }}>
                    No catalog items found. Add items in the Service Catalog page first.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="v5-summary">
          <h2>Estimate Summary</h2>

          <div className="notes-block">
            <h3>Settings</h3>
            <div className="summary-settings-grid">
              <label className="summary-settings-field">
                Payment Term
                <select
                  value={summary.contractTermMonths}
                  onChange={(e) => {
                    const months = normalizePaymentTermMonths(e.target.value);
                    updateModel((prev) => ({ ...prev, contractTermMonths: months }));
                  }}
                >
                  {PAYMENT_TERM_OPTIONS.map((months) => (
                    <option key={months} value={months}>
                      {months} {months === 1 ? 'month' : 'months'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="summary-settings-field">
                Net Terms
                <select
                  value={summary.netPaymentTerm}
                  onChange={(e) => {
                    const next = normalizeNetPaymentTerm(e.target.value);
                    updateModel((prev) => ({ ...prev, netPaymentTerm: next }));
                  }}
                >
                  {NET_PAYMENT_TERM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="summary-settings-field">
                Proposal Date
                <input
                  type="date"
                  value={model.proposalDate || ''}
                  onChange={(e) => updateModel((prev) => ({ ...prev, proposalDate: e.target.value }))}
                />
              </label>
              <label className="summary-settings-field">
                Contract Start
                <input
                  type="date"
                  value={model.contractStartDate || ''}
                  onChange={(e) => updateModel((prev) => ({ ...prev, contractStartDate: e.target.value }))}
                />
              </label>
              <label className="summary-settings-field">
                Contract End
                <input
                  type="date"
                  value={model.contractEndDate || ''}
                  onChange={(e) => updateModel((prev) => ({ ...prev, contractEndDate: e.target.value }))}
                />
              </label>
              <div className="summary-settings-note">
                Margin Gate: <strong>{summary.minMarginGatePct.toFixed(2)}%</strong> (set default in CRM Settings)
              </div>
              <button
                type="button"
                className="summary-action-btn"
                onClick={handleDownloadPdf}
              >
                Download PDF
              </button>
            </div>
          </div>

          {/* Ticket count summary */}
          <div className="summary-row ticket-summary">
            <span>Work Tickets</span>
            <strong>{sections.reduce((sum, s) => sum + Math.max(1, Math.round(Number(s.frequency || 1))), 0)} tickets</strong>
          </div>

          <div className="summary-row"><span>Total Price</span><strong>{formatCurrency(summary.totalPrice)}</strong></div>
          <div className="summary-row"><span>Total w/ Tax</span><strong>{formatCurrency(summary.totalWithTax)}</strong></div>
          <div className="summary-row"><span>Contract Start</span><strong>{formatUiDate(model.contractStartDate) || '-'}</strong></div>
          <div className="summary-row"><span>Contract End</span><strong>{formatUiDate(model.contractEndDate) || '-'}</strong></div>
          <div className="summary-row"><span>Payment Term</span><strong>{summary.contractTermMonths} {summary.contractTermMonths === 1 ? 'month' : 'months'}</strong></div>
          <div className="summary-row"><span>Per-Month Billing</span><strong>{formatCurrency(summary.monthlyPaymentWithTax)}</strong></div>
          {summary.contractTermMonths === 12 && monthlySchedulePreview.length > 0 && (
            <div className="monthly-preview-block">
              <h3>12-Month Billing Preview</h3>
              <div className="monthly-preview-grid">
                {monthlySchedulePreview.map((row) => (
                  <div key={row.label} className="monthly-preview-row">
                    <span>{row.label}</span>
                    <strong>{formatCurrency(row.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="summary-row"><span>Net Terms</span><strong>{netPaymentTermLabel(summary.netPaymentTerm)}</strong></div>
          <div className="summary-row"><span>Overhead</span><strong>{formatCurrency(summary.totalOverhead)}</strong></div>
          <div className="summary-row"><span>Break Even</span><strong>{formatCurrency(summary.totalCost)}</strong></div>
          <div className="summary-row"><span>Net Profit</span><strong>{formatPercent(summary.netProfitPct)}</strong></div>
          <div className="summary-row"><span>Gross Margin</span><strong>{formatPercent(summary.grossMarginPct)}</strong></div>
          {summary.marginBlocked && (
            <div className="summary-row" style={{ color: '#b54708', fontSize: 12 }}>
              <span>Margin Gate</span>
              <strong>{`Below ${summary.minMarginGatePct.toFixed(2)}%`}</strong>
            </div>
          )}

          {/* Approve / Status */}
          <div className="approve-block">
            {model.status === 'approved' ? (
              <div className="approved-badge">
                <CheckCircle size={14} />
                <span>Approved &mdash; Tickets Generated</span>
              </div>
            ) : (
              <button
                type="button"
                className="approve-btn"
                onClick={handleApproveEstimate}
                disabled={summary.marginBlocked}
                title={summary.marginBlocked ? `Gross margin must be at least ${summary.minMarginGatePct.toFixed(2)}%` : ''}
              >
                <CheckCircle size={14} />
                Approve &amp; Generate Tickets
              </button>
            )}
          </div>

          <div className="notes-block">
            <h3>Estimator Notes</h3>
            <textarea
              value={model.estimatorNotes || ''}
              onChange={(e) => updateModel((prev) => ({ ...prev, estimatorNotes: e.target.value }))}
              placeholder="Add notes..."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EstimatorV6Sandbox;
