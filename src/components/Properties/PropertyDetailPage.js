import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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

function PropertyDetailPage({ properties, managers, estimates }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const property = properties.find((item) => item.id === id);
  const manager = managers.find((pm) => pm.id === property?.propertyManagerId);

  const propertyEstimates = useMemo(() => {
    return estimates
      .filter((estimate) => estimate.propertyId === id)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [estimates, id]);

  if (!property) {
    return <div className="empty-state">Property not found.</div>;
  }

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

      <div className="panel-card" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <div>
            <h3>Property Estimates</h3>
            <p>All revisions and estimate history for this property.</p>
          </div>
        </div>
        {propertyEstimates.length === 0 ? (
          <div className="empty-state">
            No estimates yet for this property. Use <strong>+ New Estimate</strong> to create one.
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
                <span>{new Date(estimate.updatedAt).toLocaleDateString()}</span>
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
  );
}

export default PropertyDetailPage;
