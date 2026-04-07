import React, { useState } from 'react';

function AddPropertyModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    dealStage: 'prospecting',
    value: 20000,
  });

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>Add Property</h3>
            <p>Assign a new property to this manager.</p>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="panel-form" onSubmit={handleSubmit}>
          <label>
            Property Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Address
            <input
              type="text"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </label>
          <label>
            Deal Stage
            <select
              value={form.dealStage}
              onChange={(event) => setForm({ ...form, dealStage: event.target.value })}
            >
              <option value="prospecting">Prospecting</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
          <label>
            Value (USD)
            <input
              type="number"
              value={form.value}
              onChange={(event) => setForm({ ...form, value: Number(event.target.value) })}
            />
          </label>

          <div className="modal-actions">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Add Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPropertyModal;
