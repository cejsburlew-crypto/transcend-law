import React, { useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';

interface CreateNoteModalProps {
  caseId: string;
  onClose: () => void;
  onNoteCreated: () => void;
}

const CreateNoteModal: React.FC<CreateNoteModalProps> = ({ caseId, onClose, onNoteCreated }) => {
  const { token } = useAuth();
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!body.trim()) {
      setError('Note content is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.createNote(caseId, body, token);
      onNoteCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Internal Note</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Note *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Document case details, strategy updates, client discussions, etc."
              rows={8}
              required
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-cancel-btn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Add Note'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNoteModal;
