import React, { useEffect, useMemo, useState } from 'react';
import './SettingsPage.css';
import {
  getSupportedTimeZones,
  isHexColor,
  normalizeSettings,
} from './settingsStorage';
import {
  CREWS_STORAGE_KEY,
  isTicketClosed,
  loadCrews,
  loadTickets,
  saveCrews,
  saveTickets,
} from '../WorkTickets/ticketUtils';

const MEMBER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'disabled', label: 'Disabled' },
];

function createMemberDraft(availableRoles) {
  const role = availableRoles.includes('ReadOnly') ? 'ReadOnly' : availableRoles[0];
  return {
    name: '',
    email: '',
    role: role || 'ReadOnly',
    status: 'invited',
  };
}

function createCrewDraft() {
  return {
    name: '',
    color: '#4A90D9',
  };
}

function formatDateTime(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString();
}

function normalizeWebsiteInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function SettingsPage({ settings, onSaveSettings, roles = [] }) {
  const availableRoles = useMemo(
    () => (roles.length > 0 ? roles : ['Admin', 'Sales', 'Estimator', 'Ops', 'ReadOnly']),
    [roles],
  );
  const [draft, setDraft] = useState(() => normalizeSettings(settings));
  const [memberDraft, setMemberDraft] = useState(() => createMemberDraft(availableRoles));
  const [crews, setCrews] = useState(loadCrews);
  const [crewDraft, setCrewDraft] = useState(createCrewDraft);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const timeZones = useMemo(() => getSupportedTimeZones(), []);
  const normalizedIncoming = useMemo(() => normalizeSettings(settings), [settings]);

  useEffect(() => {
    setDraft(normalizedIncoming);
  }, [normalizedIncoming]);

  useEffect(() => {
    setMemberDraft((prev) => {
      if (availableRoles.includes(prev.role)) return prev;
      return { ...prev, role: availableRoles[0] || 'ReadOnly' };
    });
  }, [availableRoles]);

  useEffect(() => {
    function syncCrews(event) {
      if (!event?.key || event.key === CREWS_STORAGE_KEY) {
        setCrews(loadCrews());
      }
    }

    function syncLocalCrews() {
      setCrews(loadCrews());
    }

    window.addEventListener('storage', syncCrews);
    window.addEventListener('work-crews-updated', syncLocalCrews);
    return () => {
      window.removeEventListener('storage', syncCrews);
      window.removeEventListener('work-crews-updated', syncLocalCrews);
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalizedIncoming),
    [draft, normalizedIncoming],
  );

  function setField(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function patchMember(memberId, patch) {
    setDraft((prev) => ({
      ...prev,
      members: prev.members.map((member) => (
        member.id === memberId ? { ...member, ...patch } : member
      )),
    }));
  }

  function removeMember(memberId) {
    setDraft((prev) => ({
      ...prev,
      members: prev.members.filter((member) => member.id !== memberId),
    }));
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Logo must be an image file.');
      setSuccessMessage('');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo must be 2MB or smaller.');
      setSuccessMessage('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setField('logoDataUrl', String(reader.result || ''));
      setErrorMessage('');
      setSuccessMessage(`Loaded logo: ${file.name}`);
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the selected image. Please try again.');
      setSuccessMessage('');
    };
    reader.readAsDataURL(file);
  }

  function handleAddMember() {
    const name = memberDraft.name.trim();
    const email = memberDraft.email.trim().toLowerCase();

    if (!name) {
      setErrorMessage('Member name is required.');
      setSuccessMessage('');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMessage('Member email is required and must be valid.');
      setSuccessMessage('');
      return;
    }
    if (draft.members.some((member) => member.email.toLowerCase() === email)) {
      setErrorMessage('A member with this email already exists.');
      setSuccessMessage('');
      return;
    }

    const newMember = {
      id: `member-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      email,
      role: memberDraft.role,
      status: memberDraft.status,
      lastPasswordResetAt: null,
    };

    setDraft((prev) => ({
      ...prev,
      members: [...prev.members, newMember],
    }));
    setMemberDraft(createMemberDraft(availableRoles));
    setErrorMessage('');
    setSuccessMessage(`Added ${name} to members.`);
  }

  function handleResetPassword(memberId) {
    patchMember(memberId, { lastPasswordResetAt: new Date().toISOString() });
    const member = draft.members.find((item) => item.id === memberId);
    setErrorMessage('');
    setSuccessMessage(`Password reset sent (simulated) for ${member?.name || 'member'}.`);
  }

  function handleAddCrew() {
    const name = crewDraft.name.trim();
    if (!name) {
      setErrorMessage('Crew name is required.');
      setSuccessMessage('');
      return;
    }
    if (crews.some((crew) => crew.name.trim().toLowerCase() === name.toLowerCase())) {
      setErrorMessage('A crew with this name already exists.');
      setSuccessMessage('');
      return;
    }

    const newCrew = {
      id: `crew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color: isHexColor(crewDraft.color) ? crewDraft.color : '#4A90D9',
    };
    const next = saveCrews([...crews, newCrew]);
    setCrews(next);
    setCrewDraft(createCrewDraft());
    setErrorMessage('');
    setSuccessMessage(`Added ${name} to crews.`);
  }

  function patchCrew(crewId, patch) {
    if (Object.prototype.hasOwnProperty.call(patch, 'name') && !String(patch.name).trim()) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
      const nextName = String(patch.name).trim().toLowerCase();
      const duplicate = crews.some((crew) => crew.id !== crewId && crew.name.trim().toLowerCase() === nextName);
      if (duplicate) {
        setErrorMessage('Crew names must be unique.');
        setSuccessMessage('');
        return;
      }
    }

    const next = crews.map((crew) => (
      crew.id === crewId ? { ...crew, ...patch } : crew
    ));
    setCrews(saveCrews(next));
    setErrorMessage('');
  }

  function removeCrew(crewId) {
    if (crews.length <= 1) {
      setErrorMessage('At least one crew is required.');
      setSuccessMessage('');
      return;
    }

    const nextCrews = crews.filter((crew) => crew.id !== crewId);
    setCrews(saveCrews(nextCrews));

    const nowISO = new Date().toISOString();
    const ticketRows = loadTickets();
    let touched = false;
    const nextTickets = ticketRows.map((ticket) => {
      if (ticket.crewId !== crewId) return ticket;
      touched = true;
      return {
        ...ticket,
        crewId: null,
        scheduledDate: null,
        status: isTicketClosed(ticket) ? ticket.status : 'unscheduled',
        updatedAt: nowISO,
      };
    });
    if (touched) saveTickets(nextTickets);

    setErrorMessage('');
    setSuccessMessage('Crew removed. Assigned tickets were moved to unscheduled.');
  }

  function handleSave() {
    const normalized = normalizeSettings({
      ...draft,
      website: normalizeWebsiteInput(draft.website),
    });

    if (!normalized.businessName.trim()) {
      setErrorMessage('Business name is required.');
      setSuccessMessage('');
      return;
    }

    const seenEmails = new Set();
    for (const member of normalized.members) {
      const memberName = String(member.name || '').trim();
      const memberEmail = String(member.email || '').trim().toLowerCase();
      if (!memberName) {
        setErrorMessage('Each member must have a name.');
        setSuccessMessage('');
        return;
      }
      if (!memberEmail || !memberEmail.includes('@')) {
        setErrorMessage('Each member must have a valid email address.');
        setSuccessMessage('');
        return;
      }
      if (seenEmails.has(memberEmail)) {
        setErrorMessage('Duplicate member emails are not allowed.');
        setSuccessMessage('');
        return;
      }
      seenEmails.add(memberEmail);
    }

    onSaveSettings(normalized);
    setDraft(normalized);
    setErrorMessage('');
    setSuccessMessage(`Settings saved at ${new Date().toLocaleTimeString()}.`);
  }

  function handleDiscard() {
    setDraft(normalizedIncoming);
    setErrorMessage('');
    setSuccessMessage('Unsaved changes discarded.');
  }

  return (
    <section className="settings-page">
      <div className="panel-card settings-toolbar">
        <div>
          <h2>Settings</h2>
          <p>Manage business profile, branding, and user access in one place.</p>
        </div>
        <div className="settings-toolbar-actions">
          <button
            className="secondary"
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty}
          >
            Discard Changes
          </button>
          <button
            className="primary"
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
          >
            Save Settings
          </button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className={`settings-banner ${errorMessage ? 'error' : 'success'}`}>
          {errorMessage || successMessage}
        </div>
      )}

      <div className="settings-grid">
        <article className="panel-card settings-card">
          <div className="panel-header">
            <div>
              <h3>Business Profile</h3>
              <p>Core company details used throughout the CRM and client documents.</p>
            </div>
          </div>

          <div className="panel-form">
            <label>
              Business Name
              <input
                type="text"
                value={draft.businessName}
                onChange={(event) => setField('businessName', event.target.value)}
                placeholder="Business name"
              />
            </label>

            <label>
              Business Address
              <textarea
                value={draft.businessAddress}
                onChange={(event) => setField('businessAddress', event.target.value)}
                placeholder="Street, City, State ZIP"
              />
            </label>

            <label>
              Website
              <input
                type="url"
                value={draft.website}
                onChange={(event) => setField('website', event.target.value)}
                placeholder="https://yourcompany.com"
              />
            </label>

            <label>
              Time Zone
              <select
                value={draft.timeZone}
                onChange={(event) => setField('timeZone', event.target.value)}
              >
                {timeZones.map((timeZone) => (
                  <option key={timeZone} value={timeZone}>
                    {timeZone}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </article>

        <article className="panel-card settings-card">
          <div className="panel-header">
            <div>
              <h3>Estimating Defaults</h3>
              <p>Global defaults used by the V6 estimator for term, margin gating, and PDF legal text.</p>
            </div>
          </div>

          <div className="panel-form">
            <label>
              Default Contract Term (Months)
              <input
                type="number"
                min="1"
                step="1"
                value={draft.contractTermMonths}
                onChange={(event) => setField('contractTermMonths', Math.max(1, Math.round(Number(event.target.value) || 1)))}
              />
            </label>

            <label>
              Default Margin Gate (%)
              <input
                type="number"
                min="0"
                step="0.25"
                value={draft.minMarginGatePct}
                onChange={(event) => setField('minMarginGatePct', Math.max(0, Number(event.target.value) || 0))}
              />
            </label>

            <label>
              Terms &amp; Conditions — Maintenance Contract
              <textarea
                value={draft.termsMaintenanceContract || ''}
                onChange={(event) => setField('termsMaintenanceContract', event.target.value)}
                placeholder="Legal terms shown on Maintenance Contract PDFs."
              />
            </label>

            <label>
              Terms &amp; Conditions — One Time Service
              <textarea
                value={draft.termsOneTimeService || ''}
                onChange={(event) => setField('termsOneTimeService', event.target.value)}
                placeholder="Legal terms shown on One Time Service PDFs."
              />
            </label>
          </div>
        </article>

        <article className="panel-card settings-card">
          <div className="panel-header">
            <div>
              <h3>Branding & Theme</h3>
              <p>Upload your logo and set CRM primary/secondary brand colors.</p>
            </div>
          </div>

          <div className="settings-logo-block">
            <div className="settings-logo-preview">
              {draft.logoDataUrl ? (
                <img src={draft.logoDataUrl} alt="Company logo preview" />
              ) : (
                <span>No logo uploaded</span>
              )}
            </div>
            <div className="settings-logo-actions">
              <label className="secondary settings-upload-btn">
                Upload Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                />
              </label>
              <button
                className="ghost"
                type="button"
                onClick={() => setField('logoDataUrl', '')}
                disabled={!draft.logoDataUrl}
              >
                Remove Logo
              </button>
            </div>
          </div>

          <div className="settings-color-grid">
            <label>
              Primary Color
              <div className="settings-color-input-wrap">
                <input
                  type="color"
                  value={isHexColor(draft.primaryColor) ? draft.primaryColor : '#007aff'}
                  onChange={(event) => setField('primaryColor', event.target.value)}
                />
                <input
                  type="text"
                  value={draft.primaryColor}
                  onChange={(event) => setField('primaryColor', event.target.value)}
                  placeholder="#007aff"
                />
              </div>
              {!isHexColor(draft.primaryColor) && (
                <span className="settings-field-error">Use a 6-digit HEX color.</span>
              )}
            </label>

            <label>
              Secondary Color
              <div className="settings-color-input-wrap">
                <input
                  type="color"
                  value={isHexColor(draft.secondaryColor) ? draft.secondaryColor : '#0051d5'}
                  onChange={(event) => setField('secondaryColor', event.target.value)}
                />
                <input
                  type="text"
                  value={draft.secondaryColor}
                  onChange={(event) => setField('secondaryColor', event.target.value)}
                  placeholder="#0051d5"
                />
              </div>
              {!isHexColor(draft.secondaryColor) && (
                <span className="settings-field-error">Use a 6-digit HEX color.</span>
              )}
            </label>
          </div>
        </article>

        <article className="panel-card settings-card settings-card-full">
          <div className="panel-header">
            <div>
              <h3>Members & Access</h3>
              <p>Add/remove members, set role access, and trigger password resets.</p>
            </div>
          </div>

          <p className="settings-note">
            Password resets are simulated in sandbox mode until backend auth is connected.
          </p>

          <div className="settings-member-add">
            <input
              type="text"
              value={memberDraft.name}
              onChange={(event) => setMemberDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Full name"
            />
            <input
              type="email"
              value={memberDraft.email}
              onChange={(event) => setMemberDraft((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email address"
            />
            <select
              value={memberDraft.role}
              onChange={(event) => setMemberDraft((prev) => ({ ...prev, role: event.target.value }))}
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              value={memberDraft.status}
              onChange={(event) => setMemberDraft((prev) => ({ ...prev, status: event.target.value }))}
            >
              {MEMBER_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <button className="primary" type="button" onClick={handleAddMember}>
              + Add Member
            </button>
          </div>

          <div className="settings-member-table">
            <div className="settings-member-header">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Last Reset</span>
              <span>Actions</span>
            </div>

            {draft.members.map((member) => (
              <div key={member.id} className="settings-member-row">
                <input
                  type="text"
                  value={member.name}
                  onChange={(event) => patchMember(member.id, { name: event.target.value })}
                />
                <input
                  type="email"
                  value={member.email}
                  onChange={(event) => patchMember(member.id, { email: event.target.value })}
                />
                <select
                  value={member.role}
                  onChange={(event) => patchMember(member.id, { role: event.target.value })}
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select
                  value={member.status}
                  onChange={(event) => patchMember(member.id, { status: event.target.value })}
                >
                  {MEMBER_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <span>{formatDateTime(member.lastPasswordResetAt)}</span>
                <div className="settings-member-actions">
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => handleResetPassword(member.id)}
                  >
                    Reset Password
                  </button>
                  <button
                    className="ghost danger"
                    type="button"
                    onClick={() => removeMember(member.id)}
                    disabled={draft.members.length === 1}
                    title={draft.members.length === 1 ? 'At least one member is required.' : ''}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card settings-card settings-card-full">
          <div className="panel-header">
            <div>
              <h3>Crews</h3>
              <p>Manage scheduling crews used by Work Tickets and Crew Schedule.</p>
            </div>
          </div>

          <div className="settings-crew-add">
            <input
              type="text"
              value={crewDraft.name}
              onChange={(event) => setCrewDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Crew name"
            />
            <input
              type="color"
              value={isHexColor(crewDraft.color) ? crewDraft.color : '#4A90D9'}
              onChange={(event) => setCrewDraft((prev) => ({ ...prev, color: event.target.value }))}
            />
            <input
              type="text"
              value={crewDraft.color}
              onChange={(event) => setCrewDraft((prev) => ({ ...prev, color: event.target.value }))}
              placeholder="#4A90D9"
            />
            <button className="primary" type="button" onClick={handleAddCrew}>
              + Add Crew
            </button>
          </div>

          <div className="settings-crew-table">
            <div className="settings-crew-header">
              <span>Name</span>
              <span>Color</span>
              <span>Hex</span>
              <span>Actions</span>
            </div>
            {crews.map((crew) => (
              <div key={crew.id} className="settings-crew-row">
                <input
                  type="text"
                  value={crew.name}
                  onChange={(event) => patchCrew(crew.id, { name: event.target.value })}
                />
                <input
                  type="color"
                  value={isHexColor(crew.color) ? crew.color : '#4A90D9'}
                  onChange={(event) => patchCrew(crew.id, { color: event.target.value })}
                />
                <input
                  type="text"
                  value={crew.color}
                  onChange={(event) => patchCrew(crew.id, { color: event.target.value })}
                />
                <div className="settings-member-actions">
                  <button
                    className="ghost danger"
                    type="button"
                    onClick={() => removeCrew(crew.id)}
                    disabled={crews.length <= 1}
                    title={crews.length <= 1 ? 'At least one crew is required.' : ''}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default SettingsPage;
