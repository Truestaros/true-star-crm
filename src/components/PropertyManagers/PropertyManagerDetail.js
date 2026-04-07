import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EditContactModal from './EditContactModal';
import AddPropertyModal from './AddPropertyModal';
import ActivityFeed from '../Activities/ActivityFeed';

const tabs = ['overview', 'properties', 'estimates', 'activity'];

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
    () => activities.filter((a) => a.propertyManagerId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [activities, id]
  );

  const managerNotes = useMemo(() => {
    return notes
      .filter((note) => note.propertyManagerId === id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notes, id]);

  const managerProperties = properties.filter((property) => property.propertyManagerId === id);
  const managerEstimates = estimates.filter((estimate) => estimate.propertyManagerId === id);

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
          <button className="secondary" onClick={() => setShowEdit(true)} type="button">
            Edit Contact
          </button>
        </div>
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

        {activeTab === 'overview' && (
          <div className="tab-panel">
            <div className="notes-header">
              <div>
                <h3>Internal Notes</h3>
                <p>Track updates and decisions for this manager.</p>
              </div>
              <button className="primary" onClick={handleAddNote} type="button">
                Add Note
              </button>
            </div>
            <textarea
              className="note-input"
              placeholder="Add a note..."
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
            />
            <div className="notes-list">
              {managerNotes.length === 0 ? (
                <p className="empty">No notes yet.</p>
              ) : (
                managerNotes.map((note) => (
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
        )}

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
              </div>
              {managerEstimates.map((estimate) => {
                const property = properties.find((prop) => prop.id === estimate.propertyId);
                return (
                  <div
                    key={estimate.id}
                    className="table-row table-estimates clickable-row"
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
                  </div>
                );
              })}
            </div>
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
