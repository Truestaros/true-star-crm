import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Building2,
  Users,
  LogOut,
  Layers,
  FileText,
  Plus,
  AlertTriangle,
  CalendarDays,
  Settings as SettingsIcon,
  ClipboardList,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import './App.css';
import PropertyManagerList from './components/PropertyManagers/PropertyManagerList';
import PropertyManagerDetail from './components/PropertyManagers/PropertyManagerDetail';
import AddManagerModal from './components/PropertyManagers/AddManagerModal';
import PropertyListPage from './components/Properties/PropertyListPage';
import PropertyDetailPage from './components/Properties/PropertyDetailPage';
import ServiceCatalogPage from './components/Estimates/ServiceCatalogPage';
import EstimatesListPage from './components/Estimates/EstimatesListPage';
import CrewCalendar from './components/CrewCalendar/CrewCalendar';
import EstimatorV6FormulaSandbox from './components/Sandboxes/EstimatorV6FormulaSandbox';
import SettingsPage from './components/Settings/SettingsPage';
import { applyThemeColors, loadSettings, saveSettings } from './components/Settings/settingsStorage';
import WorkTicketsPage from './components/WorkTickets/WorkTicketsPage';
import { ensureEstimateTickets } from './components/WorkTickets/ticketUtils';
import {
  getPropertyManagers,
  createPropertyManager,
  updatePropertyManager,
  getProperties,
  createProperty,
  updatePropertyStage,
  getNotes,
  createNote,
  getEstimates,
  upsertEstimate,
  updateEstimateStatus,
  updateProperty,
  getActivities,
  createActivity,
  updateActivity,
} from './lib/db';

const roles = ['Admin', 'Sales', 'Estimator', 'Ops', 'ReadOnly'];
const STALE_DAYS = 14;

function getActiveViewFromPath(pathname) {
  if (pathname === '/') return 'pipeline';
  if (pathname.startsWith('/property-managers')) return 'property-managers';
  if (pathname.startsWith('/properties')) return 'properties';
  if (pathname === '/estimates') return 'estimates';
  if (pathname.startsWith('/admin/service-catalog')) return 'service-catalog';
  if (pathname.startsWith('/estimator') || pathname.startsWith('/estimates/')) return 'estimator';
  if (pathname.startsWith('/crew-schedule')) return 'crew-schedule';
  if (pathname.startsWith('/work-tickets')) return 'work-tickets';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'pipeline';
}

// Rendered inside BrowserRouter so useNavigate works
function NavNewEstimateButton({ setActiveView }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="nav-new-estimate-btn"
      onClick={() => {
        setActiveView('estimator');
        navigate('/estimator?new=1');
      }}
    >
      <Plus size={15} />
      <span className="nav-label">New Estimate</span>
    </button>
  );
}

function RouteSync({ onPathChange }) {
  const location = useLocation();
  useEffect(() => {
    onPathChange(location.pathname);
  }, [location.pathname, onPathChange]);
  return null;
}

function RedirectEstimateNewToEstimator() {
  const location = useLocation();
  return <Navigate to={`/estimator${location.search || ''}`} replace />;
}

function RedirectEstimateEditToEstimator() {
  const { id } = useParams();
  const query = id ? `?estimateId=${encodeURIComponent(id)}` : '';
  return <Navigate to={`/estimator${query}`} replace />;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('demo');
  const [activeView, setActiveView] = useState(() => getActiveViewFromPath(window.location.pathname));
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [showAddManager, setShowAddManager] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const [currentRole, setCurrentRole] = useState('Admin');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appSettings, setAppSettings] = useState(() => loadSettings());

  const [managers, setManagers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [notes, setNotes] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [activities, setActivities] = useState([]);

  // Load all data from Supabase on mount
  useEffect(() => {
    async function fetchAll() {
      try {
        const [mgrs, props, nts, ests, acts] = await Promise.all([
          getPropertyManagers(),
          getProperties(),
          getNotes(),
          getEstimates(),
          getActivities(),
        ]);
        setManagers(mgrs.map((m) => ({ ...m, createdAt: m.createdAt ? new Date(m.createdAt) : new Date() })));
        setProperties(props);
        setNotes(nts.map((n) => ({ ...n, createdAt: n.createdAt ? new Date(n.createdAt) : new Date() })));
        setActivities(acts || []);
        setEstimates(
          ests.map((e) => ({
            ...e,
            services: e.services || [],
            version: e.version || 1,
            versionHistory: e.versionHistory || [],
            approvalNote: e.approvalNote || '',
          }))
        );
      } catch (err) {
        console.error('Failed to load data from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  useEffect(() => {
    applyThemeColors(appSettings);
  }, [appSettings]);

  const pipelineStages = useMemo(
    () => [
      { key: 'prospecting', label: 'Prospecting' },
      { key: 'proposal', label: 'Proposal' },
      { key: 'negotiation', label: 'Negotiation' },
      { key: 'won', label: 'Won' },
      { key: 'lost', label: 'Lost' },
    ],
    []
  );

  const dealsByStage = useMemo(() => {
    const base = pipelineStages.reduce((acc, stage) => {
      acc[stage.key] = [];
      return acc;
    }, {});
    properties.forEach((property) => {
      if (base[property.dealStage]) {
        base[property.dealStage].push(property);
      }
    });
    return base;
  }, [pipelineStages, properties]);

  const dealStaleMap = useMemo(() => {
    const now = Date.now();
    const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;
    return properties.reduce((acc, property) => {
      const stageAnchor = property.lastStageChangeAt
        ? new Date(property.lastStageChangeAt).getTime()
        : now - 20 * 24 * 60 * 60 * 1000;
      acc[property.id] = now - stageAnchor > staleMs;
      return acc;
    }, {});
  }, [properties]);

  const dashboardKpis = useMemo(() => {
    const stageWeight = { prospecting: 0.2, proposal: 0.5, negotiation: 0.75, won: 1, lost: 0 };
    const openDeals = properties.filter((p) => p.dealStage !== 'won' && p.dealStage !== 'lost');
    const pipelineValue = openDeals.reduce((sum, p) => sum + Number(p.value), 0);
    const weightedPipeline = openDeals.reduce(
      (sum, p) => sum + Number(p.value) * (stageWeight[p.dealStage] || 0),
      0
    );
    const wonCount = properties.filter((p) => p.dealStage === 'won').length;
    const lostCount = properties.filter((p) => p.dealStage === 'lost').length;
    const decidedCount = wonCount + lostCount;
    const winRate = decidedCount > 0 ? wonCount / decidedCount : 0;
    const averageDeal = openDeals.length > 0 ? pipelineValue / openDeals.length : 0;
    const now = new Date();
    const wonThisMonth = estimates.filter((e) => {
      if (e.status !== 'approved') return false;
      const d = new Date(e.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const oneTwentyDaysOut = new Date();
    oneTwentyDaysOut.setDate(now.getDate() + 120);
    const renewalsDue = estimates.filter((e) => {
      const end = new Date(e.contractEndDate);
      return end >= now && end <= oneTwentyDaysOut;
    }).length;

    return [
      { key: 'pipeline-value', label: 'Pipeline Value', value: pipelineValue.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) },
      { key: 'weighted-pipeline', label: 'Weighted Pipeline', value: weightedPipeline.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) },
      { key: 'open-deals', label: 'Open Deals', value: openDeals.length.toString() },
      { key: 'won-this-month', label: 'Won This Month', value: wonThisMonth.toString() },
      { key: 'win-rate', label: 'Win Rate', value: `${Math.round(winRate * 100)}%` },
      { key: 'average-deal', label: 'Avg Open Deal', value: averageDeal.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) },
      { key: 'estimates-sent', label: 'Estimates Sent', value: estimates.filter((e) => e.status === 'sent').length.toString() },
      { key: 'estimates-approved', label: 'Estimates Approved', value: estimates.filter((e) => e.status === 'approved').length.toString() },
      { key: 'renewals-due', label: 'Renewals (120d)', value: renewalsDue.toString() },
      { key: 'active-managers', label: 'Active Managers', value: managers.length.toString() },
      { key: 'active-properties', label: 'Active Properties', value: properties.length.toString() },
    ];
  }, [properties, estimates, managers]);

  const rolePermissions = useMemo(
    () => ({
      canEditCatalog: true,
      canApproveEstimates: true,
      canCreateEstimates: true,
      canSendEstimates: true,
    }),
    []
  );

  const globalResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return [];
    const managerMatches = managers
      .filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.companyName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .map((m) => ({ id: `manager-${m.id}`, label: `${m.firstName} ${m.lastName}`, subLabel: m.companyName, type: 'Manager', path: `/property-managers/${m.id}` }));
    const propertyMatches = properties
      .filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
      .map((p) => ({ id: `property-${p.id}`, label: p.name, subLabel: p.address, type: 'Property', path: `/properties/${p.id}` }));
    const estimateMatches = estimates
      .filter((e) => e.proposalNumber.toLowerCase().includes(q))
      .map((e) => ({ id: `estimate-${e.id}`, label: e.proposalNumber, subLabel: e.status, type: 'Estimate', path: `/estimator?estimateId=${e.id}` }));
    return [...managerMatches, ...propertyMatches, ...estimateMatches].slice(0, 8);
  }, [globalQuery, managers, properties, estimates]);

  async function handleStageMove(propertyId, stage) {
    // Optimistic update
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, dealStage: stage, lastStageChangeAt: new Date().toISOString() } : p
      )
    );
    try {
      await updatePropertyStage(propertyId, stage);
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  async function handleAddManager(form) {
    const newManager = {
      id: uuid(),
      firstName: form.firstName,
      lastName: form.lastName,
      companyName: form.companyName,
      email: form.email,
      phone: form.phone,
      title: form.title,
      createdAt: new Date(),
    };
    setManagers((prev) => [newManager, ...prev]);
    setShowAddManager(false);
    window.history.pushState({}, '', `/property-managers/${newManager.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    try {
      await createPropertyManager(newManager);
    } catch (err) {
      console.error('Failed to save manager:', err);
    }
  }

  async function handleUpdateManager(updated) {
    setManagers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    try {
      await updatePropertyManager(updated);
    } catch (err) {
      console.error('Failed to update manager:', err);
    }
  }

  async function handleAddNote({ propertyManagerId, content, createdBy }) {
    const newNote = {
      id: uuid(),
      propertyManagerId,
      content,
      createdAt: new Date(),
      createdBy,
    };
    setNotes((prev) => [newNote, ...prev]);
    try {
      await createNote(newNote);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }

  async function handleAddProperty(data) {
    const newProperty = { id: uuid(), ...data };
    setProperties((prev) => [newProperty, ...prev]);
    try {
      await createProperty(newProperty);
    } catch (err) {
      console.error('Failed to save property:', err);
    }
  }

  async function handleEstimateStatusChange(estimateId, status, approvalNote = '') {
    const current = estimates.find((e) => e.id === estimateId);
    const nextEstimate = current
      ? { ...current, status, updatedAt: new Date().toISOString(), approvalNote: approvalNote || current.approvalNote || '' }
      : null;

    setEstimates((prev) =>
      prev.map((e) =>
        e.id === estimateId
          ? { ...e, status, updatedAt: new Date().toISOString(), approvalNote: approvalNote || e.approvalNote || '' }
          : e
      )
    );

    try {
      await updateEstimateStatus(estimateId, status, approvalNote);
    } catch (err) {
      console.error('Failed to update estimate status:', err);
    }

    // Mirror estimate status → property deal stage
    if (nextEstimate?.propertyId) {
      const stageMap = { sent: 'proposal', internal_review: 'negotiation', approved: 'negotiation', won: 'won', lost: 'lost' };
      const newStage = stageMap[status];
      if (newStage) handleStageMove(nextEstimate.propertyId, newStage);
    }

    if (nextEstimate && String(status || '').toLowerCase() === 'won') {
      const property = properties.find((p) => p.id === nextEstimate.propertyId);
      const { created } = ensureEstimateTickets({
        estimate: nextEstimate,
        propertyName: property?.name || '',
        propertyAddress: property?.address || '',
      });
      if (created > 0) {
        alert(`${created} work ticket${created === 1 ? '' : 's'} created from won estimate ${nextEstimate.proposalNumber || ''}.`);
      }
    }
  }

  async function handleSaveEstimate(estimate) {
    setEstimates((prev) => {
      const exists = prev.some((e) => e.id === estimate.id);
      return exists ? prev.map((e) => (e.id === estimate.id ? { ...e, ...estimate } : e)) : [estimate, ...prev];
    });
    try {
      await upsertEstimate(estimate);
    } catch (err) {
      console.error('Failed to save estimate:', err);
    }
  }

  async function handleUpdateProperty(updated) {
    setProperties((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    try {
      await updateProperty(updated);
    } catch (err) {
      console.error('Failed to update property:', err);
    }
  }

  async function handleAddActivity(data) {
    const newActivity = { id: uuid(), ...data, createdAt: new Date().toISOString() };
    setActivities((prev) => [newActivity, ...prev]);
    try {
      await createActivity(newActivity);
    } catch (err) {
      console.error('Failed to save activity:', err);
    }
  }

  async function handleToggleActivity(id, completed) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed } : a)));
    try {
      await updateActivity(id, { completed });
    } catch (err) {
      console.error('Failed to update activity:', err);
    }
  }

  function handleGlobalNavigate(path) {
    setGlobalQuery('');
    setShowGlobalResults(false);
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function handleSaveSettings(nextSettings) {
    setAppSettings(saveSettings(nextSettings));
  }

  const handleRoutePathChange = useCallback((pathname) => {
    setCurrentPath(pathname);
    setActiveView(getActiveViewFromPath(pathname));
  }, []);

  const sidebarTitle = appSettings.businessName || 'True Star CRM';
  const sidebarSubtitle = appSettings.website
    ? appSettings.website.replace(/^https?:\/\//i, '')
    : 'Property manager hub';

  const headerTitle = {
    pipeline: 'Deal Pipeline',
    'property-managers': 'Contacts',
    properties: 'Properties',
    estimates: 'Estimates',
    'service-catalog': 'Service Catalog',
    estimator: 'Estimator',
    'crew-schedule': 'Crew Schedule',
    'work-tickets': 'Work Tickets',
    settings: 'Settings',
  }[activeView] || 'True Star CRM';

  const headerSubtitle = {
    pipeline: 'Track open deals by stage and weighted pipeline value.',
    'property-managers': 'Property managers, contacts, and their portfolios.',
    properties: 'Commercial sites — measurements, estimates, and activity.',
    estimates: 'All proposals across every property and contact.',
    'service-catalog': 'Build the catalog of services and scope templates used in estimates.',
    estimator: 'Price proposals line by line with margin and cost controls.',
    'crew-schedule': 'Schedule crew by day and property.',
    'work-tickets': 'Active work orders and budget vs. actual tracking.',
    settings: 'Business info, branding, and app preferences.',
  }[activeView] || '';

  if (!token) {
    return <div className="auth-shell">Login disabled for mock data mode.</div>;
  }

  if (loading) {
    return (
      <div className="auth-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <img src="/logo.svg" alt="True Star" style={{ width: 28, height: 28 }} />
        <span>Loading True Star CRM…</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RouteSync onPathChange={handleRoutePathChange} />
      <div className={`crm-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`crm-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-brand">
            {appSettings.logoDataUrl ? (
              <img src={appSettings.logoDataUrl} alt={`${sidebarTitle} logo`} className="sidebar-logo-image" />
            ) : (
              <img src="/logo.svg" alt="True Star" className="sidebar-logo-image" />
            )}
            <div>
              <h2>{sidebarTitle}</h2>
              <span>{sidebarSubtitle}</span>
            </div>
          </div>

          <nav>
            {/* ── SALES ── */}
            <div className="nav-section-label"><span className="nav-label">Sales</span></div>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} end to="/" onClick={() => setActiveView('pipeline')}>
              <LayoutGrid size={18} />
              <span className="nav-label">Pipeline</span>
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/property-managers" onClick={() => setActiveView('property-managers')}>
              <Users size={18} />
              <span className="nav-label">Contacts</span>
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/properties" onClick={() => setActiveView('properties')}>
              <Building2 size={18} />
              <span className="nav-label">Properties</span>
            </NavLink>

            {/* ── ESTIMATING ── */}
            <div className="nav-section-label"><span className="nav-label">Estimating</span></div>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/estimates" onClick={() => setActiveView('estimates')}>
              <FileText size={18} />
              <span className="nav-label">Estimates</span>
            </NavLink>
            <NavNewEstimateButton setActiveView={setActiveView} />
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/admin/service-catalog" onClick={() => setActiveView('service-catalog')}>
              <Layers size={18} />
              <span className="nav-label">Service Catalog</span>
            </NavLink>

            {/* ── OPERATIONS ── */}
            <div className="nav-section-label"><span className="nav-label">Operations</span></div>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/work-tickets" onClick={() => setActiveView('work-tickets')}>
              <ClipboardList size={18} />
              <span className="nav-label">Work Tickets</span>
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/crew-schedule" onClick={() => setActiveView('crew-schedule')}>
              <CalendarDays size={18} />
              <span className="nav-label">Crew Schedule</span>
            </NavLink>

            {/* ── ACCOUNT ── */}
            <div className="nav-section-label"><span className="nav-label">Account</span></div>
            <NavLink className={({ isActive }) => (isActive ? 'active' : '')} to="/settings" onClick={() => setActiveView('settings')}>
              <SettingsIcon size={18} />
              <span className="nav-label">Settings</span>
            </NavLink>
          </nav>

          <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((prev) => !prev)}>
            {sidebarCollapsed ? '⟩⟩' : '⟨⟨'} {sidebarCollapsed ? 'Open' : 'Collapse'}
          </button>
          <button className="logout" onClick={() => setToken(null)} type="button">
            <LogOut size={18} />
            Sign out
          </button>
        </aside>

        <main className="crm-main">
          <header className="crm-header">
            <div>
              <h1>{headerTitle}</h1>
              {headerSubtitle && <p>{headerSubtitle}</p>}
            </div>
            <div className="crm-header-actions">
              <select value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} className="role-select" title="Current user role">
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <div className="global-search">
                <input
                  type="search"
                  placeholder="Search managers, properties, proposal #"
                  value={globalQuery}
                  onFocus={() => setShowGlobalResults(true)}
                  onBlur={() => setTimeout(() => setShowGlobalResults(false), 120)}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                />
                {showGlobalResults && globalQuery.trim().length > 0 && (
                  <div className="global-search-results">
                    {globalResults.length === 0 ? (
                      <div className="global-search-empty">No matches</div>
                    ) : (
                      globalResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="global-search-row"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleGlobalNavigate(result.path)}
                        >
                          <strong>{result.label}</strong>
                          <span>{result.type} - {result.subLabel}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {currentPath === '/property-managers' && (
                <button className="primary" onClick={() => setShowAddManager(true)} type="button">
                  + Add Manager
                </button>
              )}
            </div>
          </header>

          <Routes>
            <Route
              path="/"
              element={
                <section className="pipeline-view">
                  <section className="kpi-strip">
                    {dashboardKpis.map((kpi) => (
                      <article key={kpi.key} className="kpi-card">
                        <p>{kpi.label}</p>
                        <strong>{kpi.value}</strong>
                      </article>
                    ))}
                  </section>
                  <section className="kanban">
                    {pipelineStages.map((stage) => (
                      <div key={stage.key} className="kanban-column">
                        <div className="kanban-header">
                          <div>
                            <h3>{stage.label}</h3>
                            <span className="kanban-sub">
                              {dealsByStage[stage.key]
                                .reduce((sum, d) => sum + Number(d.value), 0)
                                .toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                            </span>
                          </div>
                          <span>{dealsByStage[stage.key].length}</span>
                        </div>
                        <div
                          className="kanban-list"
                          onDragEnter={(e) => e.preventDefault()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const propertyId = e.dataTransfer.getData('text/plain');
                            if (propertyId) handleStageMove(propertyId, stage.key);
                          }}
                        >
                          {dealsByStage[stage.key].map((deal) => (
                            <div
                              key={deal.id}
                              className={`deal-card ${dealStaleMap[deal.id] ? 'deal-card-stale' : ''}`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', deal.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            >
                              <div className="deal-card-title">{deal.name}</div>
                              <div className="deal-card-meta"><span>{deal.address}</span></div>
                              {dealStaleMap[deal.id] && (
                                <div className="deal-stale-badge">
                                  <AlertTriangle size={14} />
                                  Stale 14+ days
                                </div>
                              )}
                              <div className="deal-card-footer">
                                <span>{Number(deal.value).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
                                <span>{deal.dealStage}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                </section>
              }
            />
            <Route
              path="/property-managers"
              element={
                <PropertyManagerList
                  managers={managers}
                  properties={properties}
                  activities={[]}
                  onAddManager={() => setShowAddManager(true)}
                />
              }
            />
            <Route
              path="/property-managers/:id"
              element={
                <PropertyManagerDetail
                  managers={managers}
                  properties={properties}
                  notes={notes}
                  estimates={estimates}
                  activities={activities}
                  onUpdateManager={handleUpdateManager}
                  onAddNote={handleAddNote}
                  onAddProperty={handleAddProperty}
                  onAddActivity={handleAddActivity}
                  onToggleActivity={handleToggleActivity}
                />
              }
            />
            <Route path="/properties" element={<PropertyListPage properties={properties} managers={managers} />} />
            <Route path="/properties/:id" element={<PropertyDetailPage properties={properties} managers={managers} estimates={estimates} activities={activities} onUpdateProperty={handleUpdateProperty} onAddActivity={handleAddActivity} onToggleActivity={handleToggleActivity} />} />
            <Route
              path="/estimates"
              element={
                <EstimatesListPage
                  estimates={estimates}
                  properties={properties}
                  managers={managers}
                  currentRole={currentRole}
                  permissions={rolePermissions}
                  onStatusChange={handleEstimateStatusChange}
                />
              }
            />
            <Route path="/estimates/new" element={<RedirectEstimateNewToEstimator />} />
            <Route path="/estimates/:id/edit" element={<RedirectEstimateEditToEstimator />} />
            <Route
              path="/admin/service-catalog"
              element={<ServiceCatalogPage currentRole={currentRole} permissions={rolePermissions} />}
            />
            <Route
              path="/estimator"
              element={
                <EstimatorV6FormulaSandbox
                  properties={properties}
                  managers={managers}
                  estimates={estimates}
                  onSaveEstimate={handleSaveEstimate}
                />
              }
            />
            <Route path="/crew-schedule" element={<CrewCalendar />} />
            <Route path="/work-tickets" element={<WorkTicketsPage />} />
            <Route path="/settings" element={<SettingsPage settings={appSettings} onSaveSettings={handleSaveSettings} roles={roles} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {showAddManager && (
          <AddManagerModal onClose={() => setShowAddManager(false)} onSave={handleAddManager} />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
