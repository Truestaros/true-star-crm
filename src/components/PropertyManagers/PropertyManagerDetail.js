import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EditContactModal from './EditContactModal';
import AddPropertyModal from './AddPropertyModal';
import ActivityFeed from '../Activities/ActivityFeed';

const tabs = ['overview', 'properties', 'estimates', 'activity'];

const fmt = (x) =>
  Number(x).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function PropertyManagerDetail({
  managers,
  properties,
  notes,
  estimates,
  activities = [],
  onUpdateManager,
  onAddNote,
  onAddProperty,
  onAddActivity,
  onToggleActivity,
}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const manager = managers.find((item) => item.id === id);
  const [activeTab, setActiveTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [noteText, setNoteText] = useState('');

  const managerActivities = useMemo(
    () =>
      activities
        .filter((a) => a.propertyManagerId === id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [activities, id]
  );

  const managerNotes = useMemo(
    () =>
      notes
        .filter((note) => note.propertyManagerId === id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [notes, id]
  );

  const managerProperties = properties.filter((p) => p.propertyManagerId === id);
  const managerEstimates = estimates.filter((e) => e.propertyManagerId === id);

  // ── Sidebar stats ──────────────────────────────────────────────────────────
  const portfolioValue = useMemo(
    () =>
      managerEstimates
        .filter((e) => e.status === 'won' || e.status === 'approved')
        .reduce((sum, e) => sum + Number(e.annualTotal || 0), 0),
    [managerEstimates]
  );

  const openPipeline = useMemo(
    () =>
      managerEstimates
        .filter(
          (e) =>
            e.status === 'sent' ||
            e.status === 'internal_review' ||
            e.status === 'draft'
        )
        .reduce((sum, e) => sum + Number(e.annualTotal || 0), 0),
    [managerEstimates]
  );

  const nextRenewal = useMemo(() => {
    const today = new Date();
    const dates = managerEstimates
      .filter(
        (e) =>
          (e.status === 'won' || e.status === 'approved') &&
          e.contractEndDate &&
          new Date(e.contractEndDate) > today
      )
      .map((e) => new Date(e.contractEndDate));
    if (dates.length === 0) return 'None';
    const earliest = new Date(Math.min(...dates));
    return earliest.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }, [managerEstimates]);

  // ── Recent estimates (overview) ───────────────────────────────────────────
  const recentEstimates = useMemo(
    () =>
      [...managerEstimates]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3),
    [managerEstimates]
  );

  if (!manager) {
    return <div className="empty-state">Property manager not found.</div>;
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    onAddNote({
      propertyManagerId: id,
      content: noteText,
      createdBy: 'True Star User',
    });
    setNoteText('');
  }

  const today = new Date();

  return (
    <div className="pm-detail">
      <button
        onClick={() => navigate('/property-managers')}
        className="back-link"
        type="button"
      >
        ← Back to Managers
      </button>

      <aside className="pm-sidebar">
        {/* Contact card */}
        <div className="contact-card">
          <h2>
            {manager.firstName} {manager.lastName}
          </h2>
          <p className="subheading">{manager.companyName}</p>
          <div className="contact-meta">
            <a href={`mailto:${manager.email}`}>{manager.email}</a>
            <a href={`tel:${manager.phone}`}>{manager.phone}</a>
            {manager.title && <span>{manager.title}</span>}
          </div>
        </div>

        {/* Stat cards */}
        <div className="sidebar-stats">
          <div className="stat-card">
            <span className="stat-label">Portfolio Value</span>
            <span className="stat-value">{fmt(portfolioValue)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Open Pipeline</span>
            <span className="stat-value">{fmt(openPipeline)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Properties</span>
            <span className="stat-value">{managerProperties.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Next Renewal</span>
            <span className="stat-value">{nextRenewal}</span>
          </div>
        </div>

        {/* Actions */}
        <button className="secondary" onClick={() => setShowEdit(true)} type="button">
          Edit Contact
        </button>
        <button
          className="primary"
          onClick={() => navigate(`/estimator?new=1&managerId=${id}`)}
          type="button"
          style={{ marginTop: '0.5rem' }}
        >
          + New Estimate
        </button>
      </aside>

      <section className="pm-content">
        <div className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="tab-panel">
            <div className="overview-columns">
              {/* Left: Recent Estimates */}
              <div className="overview-col">
                <h3>Recent Estimates</h3>
                {recentEstimates.length === 0 ? (
                  <p className="empty">No estimates yet.</p>
                ) : (
                  recentEstimates.map((estimate) => {
                    const prop = properties.find((p) => p.id === estimate.propertyId);
                    return (
                      <div
                        key={estimate.id}
                        className="estimate-card clickable-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/estimates/${estimate.id}/edit`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/estimates/${estimate.id}/edit`);
                          }
                        }}
                      >
                        <div className="estimate-card-top">
                          <span className="estimate-proposal">{estimate.proposalNumber}</span>
                          <span className={`pill ${estimate.status}`}>{estimate.status}</span>
                        </div>
                        <div className="estimate-card-property">{prop?.name || 'Property'}</div>
                        <div className="estimate-card-bottom">
                          <span className="estimate-total">
                            {fmt(estimate.annualTotal || 0)}
                          </span>
                          {estimate.contractEndDate && (
                            <span className="estimate-end">
                              Ends {new Date(estimate.contractEndDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {managerEstimates.length > 3 && (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => setActiveTab('estimates')}
                  >
                    View all estimates →
                  </button>
                )}
              </div>

              {/* Right: Quick Note */}
              <div className="overview-col">
                <h3>Quick Note</h3>
                <textarea
                  className="note-input"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                />
                <button
                  className="primary"
                  onClick={handleAddNote}
                  type="button"
                  style={{ marginTop: '0.5rem' }}
                >
                  Add Note
                </button>

                <div className="notes-list" style={{ marginTop: '1rem' }}>
                  {managerNotes.length === 0 ? (
                    <p className="empty">No notes yet.</p>
                  ) : (
                    managerNotes.slice(0, 3).map((note) => (
                      <div key={note.id} className="note-card">
                        <div className="note-meta">
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                          <span>{note.createdBy}</span>
                        </div>
                        <p>{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Properties ───────────────────────────────────────────────────── */}
        {activeTab === 'properties' && (
          <div className="tab-panel">
            <div className="pm-properties-header">
              <div>
                <h3>{managerProperties.length} Properties</h3>
                <p>Assigned commercial sites and active deals.</p>
              </div>
              <button className="primary" onClick={() => setShowAddProperty(true)} type="button">
                + Add Property
              </button>
            </div>
            <div className="table">
              <div className="table-header">
                <span>Property Name</span>
                <span>Address</span>
                <span>Deal Stage</span>
                <span>Value</span>
              </div>
              {managerProperties.map((property) => (
                <div
                  key={property.id}
                  className="table-row clickable-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/properties/${property.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/properties/${property.id}`);
                    }
                  }}
                >
                  <span>{property.name}</span>
                  <span>{property.address}</span>
                  <span className={`pill ${property.dealStage}`}>{property.dealStage}</span>
                  <span>
                    {property.value.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Estimates ────────────────────────────────────────────────────── */}
        {activeTab === 'estimates' && (
          <div className="tab-panel">
            <div className="pm-properties-header">
              <div>
                <h3>{managerEstimates.length} Estimates</h3>
                <p>Proposals tied to this manager's properties.</p>
              </div>
            </div>
            <div className="table">
              <div className="table-header table-estimates">
                <span>Proposal #</span>
                <span>Property</span>
                <span>Status</span>
                <span>Annual Total</span>
                <span>Created</span>
                <span>Follow-up</span>
              </div>
              {managerEstimates.map((estimate) => {
                const property = properties.find((prop) => prop.id === estimate.propertyId);
                const followUpDate = estimate.followUpDate ? new Date(estimate.followUpDate) : null;
                const isOverdue = followUpDate && followUpDate < today;
                return (
                  <div
                    key={estimate.id}
                    className={`table-row table-estimates clickable-row${isOverdue ? ' row-followup-overdue' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/estimates/${estimate.id}/edit`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/estimates/${estimate.id}/edit`);
                      }
                    }}
                  >
                    <span>{estimate.proposalNumber}</span>
                    <span>{property?.name || 'Property'}</span>
                    <span className={`pill ${estimate.status}`}>{estimate.status}</span>
                    <span>
                      {Number(estimate.annualTotal || 0).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </span>
                    <span>{new Date(estimate.createdAt).toLocaleDateString()}</span>
                    <span>
                      {followUpDate ? followUpDate.toLocaleDateString() : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Activity ─────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="tab-panel">
            <ActivityFeed
              activities={managerActivities}
              propertyManagerId={id}
              onAdd={onAddActivity}
              onToggleComplete={onToggleActivity}
            />
          </div>
        )}
      </section>

      {showEdit && (
        <EditContactModal
          manager={manager}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => {
            onUpdateManager(updated);
            setShowEdit(false);
          }}
        />
      )}

      {showAddProperty && (
        <AddPropertyModal
          onClose={() => setShowAddProperty(false)}
          onSave={(data) => {
            onAddProperty({
              ...data,
              propertyManagerId: id,
            });
            setShowAddProperty(false);
          }}
        />
      )}
    </div>
  );
}

export default PropertyManagerDetail;
