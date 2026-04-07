import React from 'react';
import { useNavigate } from 'react-router-dom';

function PropertyManagerList({ managers, properties, activities, onAddManager }) {
  const navigate = useNavigate();

  const counts = managers.reduce((acc, manager) => {
    acc[manager.id] = properties.filter((property) => property.propertyManagerId === manager.id)
      .length;
    return acc;
  }, {});

  const nextActivityByManager = managers.reduce((acc, manager) => {
    const upcoming = activities
      .filter((activity) => activity.entityType === 'manager' && activity.entityId === manager.id && activity.status === 'open')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    acc[manager.id] = upcoming || null;
    return acc;
  }, {});

  function getActivityClass(activity) {
    if (!activity) return 'activity-none';
    return new Date(activity.dueDate) < new Date() ? 'activity-overdue' : 'activity-upcoming';
  }

  return (
    <div className="pm-list">
      <div className="pm-list-header">
        <div>
          <h2>Property Managers</h2>
          <p>Manage contacts and property assignments.</p>
        </div>
        <button className="primary" onClick={onAddManager} type="button">
          + Add Manager
        </button>
      </div>

      {managers.length === 0 ? (
        <div className="empty-state">No property managers yet. Add your first manager to get started.</div>
      ) : (
        <div className="table">
          <div className="table-header table-managers">
            <span>Name</span>
            <span>Company</span>
            <span># of Properties</span>
            <span>Next Activity</span>
          </div>
          {managers.map((manager) => (
            <div
              key={manager.id}
              className="table-row table-managers"
              onClick={() => navigate(`/property-managers/${manager.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/property-managers/${manager.id}`);
                }
              }}
            >
              <span>{manager.firstName} {manager.lastName}</span>
              <span>{manager.companyName}</span>
              <span>{counts[manager.id] || 0}</span>
              <span className={`next-activity ${getActivityClass(nextActivityByManager[manager.id])}`}>
                {nextActivityByManager[manager.id]
                  ? `${nextActivityByManager[manager.id].type} - ${new Date(nextActivityByManager[manager.id].dueDate).toLocaleDateString()}`
                  : 'No activity set'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PropertyManagerList;
