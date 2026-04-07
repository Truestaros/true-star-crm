import React, { useMemo, useState } from 'react';

const initialState = {
  companyName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  notes: '',
};

function AddManagerModal({ onClose, onSave }) {
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});

  const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(form.email), [form.email]);

  function validate() {
    const nextErrors = {};
    if (!form.companyName.trim()) nextErrors.companyName = 'Company is required.';
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (form.email && !isValidEmail) nextErrors.email = 'Enter a valid email.';
    if (!form.phone.trim()) nextErrors.phone = 'Phone is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>Add Property Manager</h3>
            <p>Capture key contact information for the portfolio.</p>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Cancel
          </button>
        </div>

        <form className="panel-form" onSubmit={handleSubmit}>
          <label>
            Company Name*
            <input
              type="text"
              value={form.companyName}
              onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            />
            {errors.companyName && <span className="status-error">{errors.companyName}</span>}
          </label>
          <label>
            First Name*
            <input
              type="text"
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
            {errors.firstName && <span className="status-error">{errors.firstName}</span>}
          </label>
          <label>
            Last Name*
            <input
              type="text"
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
            {errors.lastName && <span className="status-error">{errors.lastName}</span>}
          </label>
          <label>
            Email*
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            {errors.email && <span className="status-error">{errors.email}</span>}
          </label>
          <label>
            Phone*
            <input
              type="text"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            {errors.phone && <span className="status-error">{errors.phone}</span>}
          </label>
          <label>
            Title
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="textarea">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={4}
            />
          </label>

          <div className="modal-actions">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" type="submit">
              Add Manager
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddManagerModal;
