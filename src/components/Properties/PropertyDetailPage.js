import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ActivityFeed from '../Activities/ActivityFeed';

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function getRenewalLabel(contractEndDate) {
  if (!contractEndDate) return '-';
  const now = new Date();
  const end = new Date(contractEndDate);
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Overdue';
  return `${diffDays} days`;
}

const TABS = ['overview', 'estimates', 'activity'];

function MeasurementField({ label, value, unit, onChange }) {
  return (
    <div className="measurement-field">
      <label>{label}</label>
      <div className="measurement-input-row">
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          placeholder="0"
        />
        <span className="measurement-unit">{unit}</span>
      </div>
    </div>
  );
}

function PropertyDetailPage({
  properties,
  managers,
  estimates,
  activities = [],
  onUpdateProperty,
  onAddActivity,
  onToggleActivity,
}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const property = properties.find((item) => item.id === id);
  const manager = managers.find((pm) => pm.id === property?.propertyManagerId);
  const [activeTab, setActiveTab] = useState('overview');
  const [measurements, setMeasurements] = useState(null);

  const propertyEstimates = useMemo(() => {
    return estimates
      .filter((estimate) => estimate.propertyId === id)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }, [estimates, id]);

  const propertyActivities = useMemo(
    () => activities.filter((a) => a.propertyId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [activities, id]
  );

  if (!property) {
    return <div className="empty-state">Property not found.</div>;
  }

  // Initialize measurements edit state from property
  const m = measurements || {
    turfSqFt: property.turfSqFt || 0,
    bedAreaSqFt: property.bedAreaSqFt || 0,
    hardscapeSqFt: property.hardscapeSqFt || 0,
    irrigationZones: property.irrigationZones || 0,
    lotSqFt: property.lotSqFt || 0,
  };

  function saveMeasurements() {
    if (onUpdateProperty) {
      onUpdateProperty({ ...property, ...m });
    }
    setMeasurements(null);
  }

  const measurementsDirty = measurements !== null;

  return (
    <div className="panel-card">
      <button onClick={() => navigate('/properties')} className="back-link" type="button">
        ← Back to Properties
      </button>
      <div className="panel-header">
        <div>
          <h3>{property.name}</h3>
          <p>{property.address}</p>
        </div>
        <button
          className="primary"
          type="button"
          onClick={() => navigate(`/estimates/new?propertyId=${property.id}`)}
        >
          + New Estimate
        </button>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h4>Property Manager</h4>
          <p>{manager ? `${manager.firstName} ${manager.lastName}` : 'Unassigned'}</p>
          <p>{manager?.companyName || '—'}</p>
        </div>
        <div className="detail-card">
          <h4>Deal Stage</h4>
          <p className={`pill ${property.dealStage}`}>{property.dealStage}</p>
        </div>
        <div className="detail-card">
          <h4>Annual Value</h4>
          <p>{formatCurrency(property.value)}</p>
        </div>
      </div>

      <div className="tab-bar" style={{ marginTop: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="tab-panel">
          <div className="panel-card" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div>
                <h3>Site Measurements</h3>
                <p>Used by the estimator to suggest service quantities.</p>
              </div>
              {measurementsDirty && (
                <button className="primary" type="button" onClick={saveMeasurements}>
                  Save Measurements
                </button>
              )}
            </div>
            <div className="measurements-grid">
              <MeasurementField
                label="Turf Area"
                unit="sq ft"
                value={m.turfSqFt}
                onChange={(v) => setMeasurements({ ...m, turfSqFt: v })}
              />
              <MeasurementField
                label="Bed Area"
                unit="sq ft"
                value={m.bedAreaSqFt}
                onChange={(v) => setMeasurements({ ...m, bedAreaSqFt: v })}
              />
              <MeasurementField
                label="Hardscape"
                unit="sq ft"
                value={m.hardscapeSqFt}
                onChange={(v) => setMeasurements({ ...m, hardscapeSqFt: v })}
              />
              <MeasurementField
                label="Irrigation Zones"
                unit="zones"
                value={m.irrigationZones}
                onChange={(v) => setMeasurements({ ...m, irrigationZones: v })}
              />
              <MeasurementField
                label="Total Lot"
                unit="sq ft"
                value={m.lotSqFt}
                onChange={(v) => setMeasurements({ ...m, lotSqFt: v })}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estimates' && (
        <div className="tab-panel">
          <div className="panel-card" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div>
                <h3>Property Estimates</h3>
                <p>All revisions and estimate history for this property.</p>
              </div>
            </div>
            {propertyEstimates.length === 0 ? (
              <div className="empty-state">
                No estimates yet. Use <strong>+ New Estimate</strong> to create one.
              </div>
            ) : (
              <div className="table">
                <div
                  className="table-header"
                  style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1fr 0.8fr 1fr 0.8fr' }}
                >
                  <span>Proposal #</span>
                  <span>Version</span>
                  <span>Status</span>
                  <span>Annual Total</span>
                  <span>Renewal</span>
                  <span>Updated</span>
                  <span>Actions</span>
                </div>
                {propertyEstimates.map((estimate) => (
                  <div
                    key={estimate.id}
                    className="table-row"
                    style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1fr 0.8fr 1fr 0.8fr' }}
                  >
                    <span style={{ fontWeight: 600 }}>{estimate.proposalNumber}</span>
                    <span>v{estimate.version || 1}</span>
                    <span>
                      <span className={`category-pill ${estimate.status === 'approved' ? 'pill-turf' : estimate.status === 'sent' ? 'pill-irrigation' : estimate.status === 'internal_review' ? 'pill-seasonal' : 'pill-inspections'}`}>
                        {estimate.status}
                      </span>
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatCurrency(estimate.annualTotal)}
                    </span>
                    <span>{getRenewalLabel(estimate.contractEndDate)}</span>
                    <span>{new Date(estimate.updatedAt || estimate.createdAt).toLocaleDateString()}</span>
                    <span>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => navigate(`/estimates/${estimate.id}/edit`)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        Open
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="tab-panel" style={{ marginTop: 16 }}>
          <ActivityFeed
            activities={propertyActivities}
            propertyId={id}
            onAdd={onAddActivity}
            onToggleComplete={onToggleActivity}
          />
        </div>
      )}
    </div>
  );
}

export default PropertyDetailPage;
