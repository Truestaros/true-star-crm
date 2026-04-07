import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, FileText, GripVertical, MoreVertical, Plus, PlusCircle } from 'lucide-react';
import './EstimatorV6Sandbox.css';

const STORAGE_KEY = 'tsos-estimator-v6-sandbox-v3';
const DEFAULT_TAX_RATE = 0.089;
const TICKETS_STORAGE_KEY = 'tsos-work-tickets-v1';

/* Clean up all old storage keys on first load */
(function purgeOldKeys() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('tsos-estimator-v6-sandbox') && k !== STORAGE_KEY) {
      localStorage.removeItem(k);
    }
  }
})();

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
  return {
    estimateId: uid('est-v6'),
    estimateNumber: '378',
    estimateTitle: 'Design Build Front Entry',
    locationName: 'Station Place',
    propertyAddress: '1423 Elm Street, Dallas, TX 75201',
    status: 'draft',
    estimatorNotes: '',
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultModel();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sections)) return createDefaultModel();
    return {
      estimateId: uid('est-v6'),
      propertyAddress: '',
      status: 'draft',
      laborRates: { maintenance: 45, planting: 60, irrigation: 75 },
      ...parsed,
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

function computeItem(item, sectionComplexityPct, taxRate) {
  const quantity = Math.max(Number(item.quantity || 0), 0);
  const hours = Math.max(Number(item.hours || 0), 0);
  const unitCost = Math.max(Number(item.unitCost || 0), 0);
  const gmPctBase = clamp(Number(item.gmPct || 0), 0, 95);
  const overheadPctBase = Math.max(Number(item.overheadPct || 0), 0);
  const complexityFactor = Math.max(0.1, 1 + (Number(sectionComplexityPct || 0) / 100));

  // Cost is the anchor — unitCost is what you pay per unit
  const totalCost = quantity * unitCost * complexityFactor;

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

  const totalHours = quantity > 0 ? hours : 0;

  return {
    ...item,
    quantity,
    hours,
    unitCost,
    unitPrice,
    totalHours,
    totalPrice,
    totalCost,
    totalOverhead,
    priceWithTax,
    gmPct,
  };
}

function computeSection(section) {
  const computedItems = (section.items || []).map((item) =>
    computeItem(item, section.complexityPct, section.taxRate),
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

function EstimatorV6Sandbox() {
  const [model, setModel] = useState(loadModel);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  }, [model]);

  const sections = useMemo(() => (model.sections || []).map(computeSection), [model.sections]);

  const summary = useMemo(() => {
    const totals = sections.reduce(
      (acc, section) => {
        acc.totalPrice += section.totals.totalPrice;
        acc.totalOverhead += section.totals.totalOverhead;
        acc.totalCost += section.totals.totalCost;
        return acc;
      },
      { totalPrice: 0, totalOverhead: 0, totalCost: 0 },
    );
    const grossMarginPct = totals.totalPrice > 0
      ? ((totals.totalPrice - totals.totalCost) / totals.totalPrice) * 100
      : 0;
    const netProfitPct = totals.totalPrice > 0
      ? ((totals.totalPrice - totals.totalCost - totals.totalOverhead) / totals.totalPrice) * 100
      : 0;
    return { ...totals, grossMarginPct, netProfitPct };
  }, [sections]);

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
            const currentUnitCost = Math.max(Number(item.unitCost || 0), 0);
            const currentCost = quantity * currentUnitCost * complexityFactor;
            const next = { ...item };

            if (field === 'totalPrice') {
              // User changed selling price → back-solve GM%
              if (value > 0 && currentCost > 0) {
                next.gmPct = clamp((1 - currentCost / value) * 100, 0, 95);
              }
            }
            if (field === 'totalCost') {
              // User changed cost → back-solve unitCost
              if (quantity > 0 && complexityFactor > 0) {
                next.unitCost = value / (quantity * complexityFactor);
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

  function handleApproveEstimate() {
    if (model.status === 'approved') return;

    // Check for existing tickets with same estimateId (prevent duplicates)
    const existingRaw = localStorage.getItem(TICKETS_STORAGE_KEY);
    const existingTickets = existingRaw ? JSON.parse(existingRaw) : [];
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
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(allTickets));

    // Set estimate status to approved
    updateModel((prev) => ({ ...prev, status: 'approved' }));

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
          <span className="property-address-label">Property:</span>
          <input
            className="property-address-input"
            value={model.propertyAddress || ''}
            onChange={(e) => updateModel((prev) => ({ ...prev, propertyAddress: e.target.value }))}
            placeholder="Enter property address..."
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
                              const costSum = section.computedItems.reduce((s, i) => s + i.totalCost, 0);
                              if (costSum <= 0) return;
                              const newGm = clamp((1 - costSum / (parseFloat(e.target.value) || 1)) * 100, 0, 95);
                              section.computedItems.forEach((i) => {
                                updateItem(section.id, i.id, { gmPct: newGm });
                              });
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
          </div>
        </div>

        <aside className="v5-summary">
          <h2>Estimate Summary</h2>

          {/* Ticket count summary */}
          <div className="summary-row ticket-summary">
            <span>Work Tickets</span>
            <strong>{sections.reduce((sum, s) => sum + Math.max(1, Math.round(Number(s.frequency || 1))), 0)} tickets</strong>
          </div>

          <div className="summary-row"><span>Total Price</span><strong>{formatCurrency(summary.totalPrice)}</strong></div>
          <div className="summary-row"><span>Overhead</span><strong>{formatCurrency(summary.totalOverhead)}</strong></div>
          <div className="summary-row"><span>Break Even</span><strong>{formatCurrency(summary.totalCost)}</strong></div>
          <div className="summary-row"><span>Net Profit</span><strong>{formatPercent(summary.netProfitPct)}</strong></div>
          <div className="summary-row"><span>Gross Margin</span><strong>{formatPercent(summary.grossMarginPct)}</strong></div>

          {/* Approve / Status */}
          <div className="approve-block">
            {model.status === 'approved' ? (
              <div className="approved-badge">
                <CheckCircle size={14} />
                <span>Approved &mdash; Tickets Generated</span>
              </div>
            ) : (
              <button type="button" className="approve-btn" onClick={handleApproveEstimate}>
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
