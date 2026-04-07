import React from 'react';

function PdfPreviewModal({ blobUrl, onClose, onDownload }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card pdf-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>Proposal Preview</h3>
            <p>Review the proposal before downloading.</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="pdf-preview">
          <iframe title="Proposal Preview" src={blobUrl} />
        </div>
        <div className="modal-actions">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="button" onClick={onDownload}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default PdfPreviewModal;
