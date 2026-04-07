import React, { useState } from 'react';

function EditContactModal({ manager, onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: manager.firstName,
    lastName: manager.lastName,
    companyName: manager.companyName,
    email: manager.email,
    phone: manager.phone,
    title: manager.title || '',
  });

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ ...manager, ...form });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>Edit Contact</h3>
            <p>Update contact details for this property manager.</p>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="panel-form" onSubmit={handleSubmit}>
          <label>
            Company Name
            <input
              type="text"
              value={form.companyName}
              onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            />
          </label>
          <label>
            First Name
            <input
              type="text"
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
          </label>
          <label>
            Last Name
            <input
              type="text"
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Phone
            <input
              type="text"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <label>
            Title
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>

          <div className="modal-actions">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditContactModal;
