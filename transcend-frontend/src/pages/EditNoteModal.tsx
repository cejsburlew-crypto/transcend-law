import React, { useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';

interface Note {
  id: string;
  from_user: string;
  body: string;
  created_at: string;
}

interface EditNoteModalProps {
  note: Note;
  currentUserId?: string;
  onClose: () => void;
  onNoteUpdated: () => void;
}

const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, currentUserId, onClose, onNoteUpdated }) => {
  const { token } = useAuth();
  const [body, setBody] = useState(note.body);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnNote = currentUserId && note.from_user === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isOwnNote) return;

    if (!body.trim()) {
      setError('Note content is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.updateNote(note.id, body, token);
      onNoteUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Note</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Note *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
              {loading ? 'Saving...' : 'Save Changes'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNoteModal;
