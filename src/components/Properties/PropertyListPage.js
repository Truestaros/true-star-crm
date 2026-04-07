import React from 'react';
import { useNavigate } from 'react-router-dom';

function PropertyListPage({ properties, managers }) {
  const navigate = useNavigate();

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Properties</h3>
          <p>View active properties in the portfolio.</p>
        </div>
      </div>
      <div className="table">
        <div className="table-header table-properties">
          <span>Property</span>
          <span>Address</span>
          <span>Property Manager</span>
          <span>Deal Stage</span>
        </div>
        {properties.map((property) => {
          const manager = managers.find((pm) => pm.id === property.propertyManagerId);
          return (
            <div
              key={property.id}
              className="table-row table-properties"
              onClick={() => navigate(`/properties/${property.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/properties/${property.id}`);
                }
              }}
            >
              <span>{property.name}</span>
              <span>{property.address}</span>
              <span>{manager ? `${manager.firstName} ${manager.lastName}` : '—'}</span>
              <span className={`pill ${property.dealStage}`}>{property.dealStage}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PropertyListPage;
