import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const renewalFilters = [
  { key: 'all', label: 'All Renewals' },
  { key: '120', label: 'Due 120d' },
  { key: '90', label: 'Due 90d' },
  { key: '60', label: 'Due 60d' },
  { key: '30', label: 'Due 30d' },
  { key: 'overdue', label: 'Overdue' },
];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function getRenewalBucket(contractEndDate) {
  if (!contractEndDate) return null;
  const now = new Date();
  const end = new Date(contractEndDate);
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return '30';
  if (diffDays <= 60) return '60';
  if (diffDays <= 90) return '90';
  if (diffDays <= 120) return '120';
  return null;
}

function getStatusClass(status) {
  if (status === 'draft') return 'pill-inspections';
  if (status === 'internal_review') return 'pill-seasonal';
  if (status === 'sent') return 'pill-irrigation';
  if (status === 'approved') return 'pill-turf';
  if (status === 'won') return 'pill-turf';
  if (status === 'lost') return 'pill-optional';
  return 'pill-optional';
}

function EstimatesListPage({
  estimates,
  properties,
  managers,
  onStatusChange,
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [renewalFilter, setRenewalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = useMemo(() => {
    const mapped = estimates.map((estimate) => {
      const property = properties.find((item) => item.id === estimate.propertyId);
      const manager = managers.find((item) => item.id === estimate.propertyManagerId);
      const renewalBucket = getRenewalBucket(estimate.contractEndDate);
      return {
        ...estimate,
        propertyName: property?.name || 'Unknown',
        managerName: manager ? `${manager.firstName} ${manager.lastName}` : 'Unknown',
        renewalBucket,
      };
    });

    const filtered = mapped.filter((row) => {
      const searchMatch =
        row.proposalNumber.toLowerCase().includes(search.toLowerCase()) ||
        row.propertyName.toLowerCase().includes(search.toLowerCase()) ||
        row.managerName.toLowerCase().includes(search.toLowerCase());
      const statusMatch = statusFilter === 'all' || row.status === statusFilter;
      const renewalMatch =
        renewalFilter === 'all' ||
        (renewalFilter === 'overdue' && row.renewalBucket === 'overdue') ||
        row.renewalBucket === renewalFilter;
      return searchMatch && statusMatch && renewalMatch;
    });

    return [...filtered].sort((a, b) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'annualTotal') return ((a.annualTotal || 0) - (b.annualTotal || 0)) * modifier;
      if (sortKey === 'createdAt') return (new Date(a.createdAt) - new Date(b.createdAt)) * modifier;
      if (sortKey === 'version') return ((a.version || 1) - (b.version || 1)) * modifier;
      if (sortKey === 'contractEndDate') {
        return (new Date(a.contractEndDate) - new Date(b.contractEndDate)) * modifier;
      }
      return String(a[sortKey] || '').localeCompare(String(b[sortKey] || '')) * modifier;
    });
  }, [estimates, properties, managers, search, sortKey, sortDirection, renewalFilter, statusFilter]);

  const renewalCounts = useMemo(() => {
    return estimates.reduce(
      (acc, estimate) => {
        const bucket = getRenewalBucket(estimate.contractEndDate);
        if (bucket) acc[bucket] += 1;
        return acc;
      },
      { 120: 0, 90: 0, 60: 0, 30: 0, overdue: 0 },
    );
  }, [estimates]);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  }

  function handleStatusAction(row, nextStatus) {
    if (!onStatusChange) return;
    let note = '';
    if (nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'lost') {
      const promptLabel = nextStatus === 'lost'
        ? 'Lost reason (required for audit trail):'
        : 'Approval note (required for audit trail):';
      note = window.prompt(promptLabel, row.approvalNote || '') || '';
      if (!note.trim()) return;
    }
    onStatusChange(row.id, nextStatus, note.trim());
  }

  function renderActions(row) {
    if (row.status === 'draft') {
      return (
        <button className="ghost" type="button" onClick={() => handleStatusAction(row, 'internal_review')}>
          Submit
        </button>
      );
    }
    if (row.status === 'internal_review') {
      return (
        <div className="row-actions">
          <button className="ghost" type="button" onClick={() => handleStatusAction(row, 'approved')}>
            Approve
          </button>
          <button className="ghost danger-text" type="button" onClick={() => handleStatusAction(row, 'rejected')}>
            Reject
          </button>
        </div>
      );
    }
    if (row.status === 'approved') {
      return (
        <button className="ghost" type="button" onClick={() => handleStatusAction(row, 'sent')}>
          Send
        </button>
      );
    }
    if (row.status === 'sent') {
      return (
        <div className="row-actions">
          <button className="ghost" type="button" onClick={() => handleStatusAction(row, 'won')}>
            Won
          </button>
          <button className="ghost danger-text" type="button" onClick={() => handleStatusAction(row, 'lost')}>
            Lost
          </button>
        </div>
      );
    }
    return <span className="muted tiny-label">-</span>;
  }

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>All Estimates</h3>
          <p>Reporting view for status, approvals, and renewals. Create estimates from Property detail.</p>
        </div>
      </div>

      <div className="renewal-alerts">
        {renewalFilters
          .filter((item) => item.key !== 'all')
          .map((item) => (
            <button
              key={item.key}
              type="button"
              className={`renewal-chip ${renewalFilter === item.key ? 'active' : ''}`}
              onClick={() => setRenewalFilter(item.key)}
            >
              {item.label}: {renewalCounts[item.key]}
            </button>
          ))}
        <button
          type="button"
          className={`renewal-chip ${renewalFilter === 'all' ? 'active' : ''}`}
          onClick={() => setRenewalFilter('all')}
        >
          Reset
        </button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search estimates"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="internal_review">Internal Review</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">No estimates match your filters.</div>
      ) : (
        <div className="table">
          <div
            className="table-header"
            style={{
              gridTemplateColumns: '0.8fr 1fr 1.4fr 1fr 1fr 0.8fr 0.8fr 1fr 0.8fr',
            }}
          >
            <button type="button" onClick={() => handleSort('version')}>Version</button>
            <button type="button" onClick={() => handleSort('proposalNumber')}>Proposal #</button>
            <button type="button" onClick={() => handleSort('propertyName')}>Property</button>
            <button type="button" onClick={() => handleSort('managerName')}>PM</button>
            <button type="button" onClick={() => handleSort('annualTotal')}>Annual Total</button>
            <button type="button" onClick={() => handleSort('status')}>Status</button>
            <button type="button" onClick={() => handleSort('contractEndDate')}>Renewal</button>
            <button type="button" onClick={() => handleSort('createdAt')}>Created</button>
            <span>Actions</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.id}
              className="table-row"
              style={{
                gridTemplateColumns: '0.8fr 1fr 1.4fr 1fr 1fr 0.8fr 0.8fr 1fr 0.8fr',
              }}
            >
              <span style={{ fontWeight: 600 }}>v{row.version || 1}</span>
              <span style={{ fontWeight: 600 }}>{row.proposalNumber}</span>
              <span>{row.propertyName}</span>
              <span>{row.managerName}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(row.annualTotal)}
              </span>
              <span>
                <span className={`category-pill ${getStatusClass(row.status)}`}>{row.status}</span>
                {row.approvalNote && <span className="approval-note-chip">note</span>}
              </span>
              <span>
                {row.renewalBucket ? (
                  <span className={`renewal-pill renewal-${row.renewalBucket}`}>{row.renewalBucket === 'overdue' ? 'overdue' : `${row.renewalBucket}d`}</span>
                ) : (
                  <span className="muted tiny-label">-</span>
                )}
              </span>
              <span>{formatDate(row.createdAt)}</span>
              <span className="row-actions">
                <button
                  className="ghost"
                  type="button"
                  onClick={() => navigate(`/estimates/${row.id}/edit`)}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Edit
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => navigate(`/properties/${row.propertyId}`)}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Property
                </button>
                {renderActions(row)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EstimatesListPage;
