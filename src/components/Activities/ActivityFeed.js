import React, { useState } from 'react';

const ACTIVITY_TYPES = [
  { key: 'call',       label: 'Call',       icon: '📞' },
  { key: 'email',      label: 'Email',      icon: '✉️' },
  { key: 'meeting',    label: 'Meeting',    icon: '🤝' },
  { key: 'site_visit', label: 'Site Visit', icon: '📍' },
  { key: 'task',       label: 'Task',       icon: '✅' },
  { key: 'note',       label: 'Note',       icon: '📝' },
];

function typeFor(key) {
  return ACTIVITY_TYPES.find((t) => t.key === key) || ACTIVITY_TYPES[5];
}

function formatRelative(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

const EMPTY_FORM = { type: 'note', title: '', body: '', dueDate: '' };

function ActivityFeed({
  activities = [],
  onAdd,
  onToggleComplete,
  propertyId,
  propertyManagerId,
  createdBy = 'True Star User',
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);

  function handleSubmit() {
    if (!form.title.trim() && !form.body.trim()) return;
    onAdd({
      type: form.type,
      title: form.title.trim(),
      body: form.body.trim(),
      dueDate: form.dueDate || null,
      completed: false,
      propertyId: propertyId || null,
      propertyManagerId: propertyManagerId || null,
      createdBy,
    });
    setForm(EMPTY_FORM);
    setOpen(false);
  }

  const incomplete = activities.filter((a) => a.type === 'task' && !a.completed);
  const nextAction = incomplete.length > 0
    ? incomplete.reduce((earliest, a) => {
        if (!earliest.dueDate) return a;
        if (!a.dueDate) return earliest;
        return new Date(a.dueDate) < new Date(earliest.dueDate) ? a : earliest;
      })
    : null;

  return (
    <div className="activity-feed">
      {nextAction && (
        <div className="activity-next-action">
          <span className="activity-next-label">Next Action</span>
          <span className="activity-next-title">{nextAction.title || nextAction.body}</span>
          {nextAction.dueDate && (
            <span className="activity-next-due">
              Due {new Date(nextAction.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      <div className="activity-header">
        <h4>Activity</h4>
        <button className="primary" type="button" onClick={() => setOpen((prev) => !prev)}>
          {open ? 'Cancel' : '+ Log Activity'}
        </button>
      </div>

      {open && (
        <div className="activity-form panel-card">
          <div className="activity-type-picker">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`type-pill${form.type === t.key ? ' active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, type: t.key }))}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="activity-title-input"
            placeholder="Title (e.g. Called Avery re: renewal)"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <textarea
            className="activity-body-input"
            placeholder="Details / notes..."
            rows={3}
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
          />
          {form.type === 'task' && (
            <div className="activity-due-row">
              <label>Due date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          )}
          <div className="activity-form-actions">
            <button type="button" className="primary" onClick={handleSubmit}>Save</button>
          </div>
        </div>
      )}

      <div className="activity-list">
        {activities.length === 0 ? (
          <p className="empty" style={{ padding: '16px 0', color: 'var(--muted)' }}>
            No activity logged yet. Log a call, email, meeting, or task above.
          </p>
        ) : (
          activities.map((activity) => {
            const t = typeFor(activity.type);
            const isTask = activity.type === 'task';
            return (
              <div
                key={activity.id}
                className={`activity-item${activity.completed ? ' completed' : ''}`}
              >
                <div className="activity-icon-col">
                  <span className="activity-type-icon">{t.icon}</span>
                </div>
                <div className="activity-content">
                  <div className="activity-meta-row">
                    <span className="activity-type-label">{t.label}</span>
                    <span className="activity-timestamp">{formatRelative(activity.createdAt)}</span>
                    {activity.createdBy && (
                      <span className="activity-by">· {activity.createdBy}</span>
                    )}
                  </div>
                  {activity.title && (
                    <div className="activity-title-text">{activity.title}</div>
                  )}
                  {activity.body && (
                    <div className="activity-body-text">{activity.body}</div>
                  )}
                  {isTask && activity.dueDate && (
                    <div className={`activity-due-label${new Date(activity.dueDate) < new Date() && !activity.completed ? ' overdue' : ''}`}>
                      Due {new Date(activity.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {isTask && onToggleComplete && (
                  <button
                    type="button"
                    className={`task-toggle${activity.completed ? ' done' : ''}`}
                    title={activity.completed ? 'Mark incomplete' : 'Mark complete'}
                    onClick={() => onToggleComplete(activity.id, !activity.completed)}
                  >
                    {activity.completed ? '✓' : '○'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
