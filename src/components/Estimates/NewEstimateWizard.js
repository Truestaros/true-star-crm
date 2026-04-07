import React, { useState } from 'react';

const TEMPLATES_KEY = 'tsos-catalog-templates-v1';

function loadScopeTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function NewEstimateWizard({ onConfirm, onCancel }) {
  const [step, setStep] = useState(1);
  const [jobType, setJobType] = useState(null);
  const [templates] = useState(loadScopeTemplates);

  function handleJobTypeSelect(type) {
    setJobType(type);
    setStep(2);
  }

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true">
      <div className="wizard-modal">
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-steps">
            <span className={`wizard-step-pill${step === 1 ? ' active' : step > 1 ? ' done' : ''}`}>
              1 &nbsp;Job Type
            </span>
            <span className="wizard-step-arrow">›</span>
            <span className={`wizard-step-pill${step === 2 ? ' active' : ''}`}>
              2 &nbsp;Scope Template
            </span>
          </div>
          <button type="button" className="wizard-close-btn" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        {/* Step 1 — Job Type */}
        {step === 1 && (
          <div className="wizard-body">
            <div className="wizard-intro">
              <h2>What type of estimate?</h2>
              <p>This sets the billing structure, PDF format, and available scope templates.</p>
            </div>
            <div className="wizard-job-cards">
              <button
                type="button"
                className="wizard-job-card"
                onClick={() => handleJobTypeSelect('maintenance_contract')}
              >
                <div className="wizard-job-card-icon">📋</div>
                <div className="wizard-job-card-body">
                  <h3>Maintenance Contract</h3>
                  <p>Recurring service agreement with monthly billing, contract term, annual total, and visit frequency per service. Ideal for lawn care, irrigation programs, and seasonal maintenance.</p>
                  <div className="wizard-job-card-tags">
                    <span>Monthly Billing</span>
                    <span>Annual Contract</span>
                    <span>Visit Frequency</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="wizard-job-card"
                onClick={() => handleJobTypeSelect('one_time_service')}
              >
                <div className="wizard-job-card-icon">🔧</div>
                <div className="wizard-job-card-body">
                  <h3>One Time Service</h3>
                  <p>Single-event project with a lump-sum price. For enhancements, tree service, agronomy treatments, design-build, mulch installs, or any non-recurring work.</p>
                  <div className="wizard-job-card-tags">
                    <span>Lump Sum</span>
                    <span>No Contract Term</span>
                    <span>One Event</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Scope Template */}
        {step === 2 && (
          <div className="wizard-body">
            <button type="button" className="wizard-back-btn" onClick={() => setStep(1)}>
              ← Back
            </button>
            <div className="wizard-intro">
              <h2>Load a scope template?</h2>
              <p>
                Pre-populate line items from a saved template, or start blank.
                {' '}
                <span className="wizard-job-type-badge">
                  {jobType === 'maintenance_contract' ? '📋 Maintenance Contract' : '🔧 One Time Service'}
                </span>
              </p>
            </div>
            <div className="wizard-template-list">
              {/* Start blank */}
              <button
                type="button"
                className="wizard-template-card wizard-template-blank"
                onClick={() => onConfirm(jobType, null)}
              >
                <div className="wizard-template-card-icon">+</div>
                <div className="wizard-template-card-body">
                  <h3>Start Blank</h3>
                  <p>Empty estimate — add sections and items manually.</p>
                </div>
              </button>

              {/* Saved templates */}
              {templates.length === 0 && (
                <p className="wizard-no-templates">
                  No scope templates saved yet. Build templates in <strong>Service Catalog → Templates</strong>.
                </p>
              )}
              {templates.map((tpl) => {
                const sectionCount = (tpl.sections || []).length;
                const itemCount = (tpl.sections || []).reduce((sum, s) => sum + (s.items || []).length, 0);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className="wizard-template-card"
                    onClick={() => onConfirm(jobType, tpl)}
                  >
                    <div className="wizard-template-card-icon">📂</div>
                    <div className="wizard-template-card-body">
                      <h3>{tpl.name || 'Untitled Template'}</h3>
                      {tpl.description && <p>{tpl.description}</p>}
                      <div className="wizard-template-meta">
                        {sectionCount} {sectionCount === 1 ? 'section' : 'sections'} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NewEstimateWizard;
