import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';
import NoteCard from '@/pages/NoteCard';
import CreateNoteModal from '@/pages/CreateNoteModal';
import EditNoteModal from '@/pages/EditNoteModal';

interface Note {
  id: string;
  case_id: string;
  type: string;
  from_user: string;
  body: string;
  created_at: string;
  updated_at?: string;
}

interface NotesTabProps {
  caseId: string;
}

const NotesTab: React.FC<NotesTabProps> = ({ caseId }) => {
  const { token, user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [caseId]);

  const fetchNotes = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.getNotesByCase(caseId, token);
      setNotes(Array.isArray(data) ? data : data.notes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleNoteCreated = () => {
    setShowCreateModal(false);
    fetchNotes();
  };

  const handleNoteUpdated = () => {
    setEditingNote(null);
    fetchNotes();
  };

  const handleNoteDeleted = async (noteId: string) => {
    if (!token || !window.confirm('Delete this note?')) return;
    try {
      await api.deleteNote(noteId, token);
      fetchNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  return (
    <div className="tab-pane">
      <div className="section">
        <div className="section-header">
          <h2>Internal Notes</h2>
          <PrimaryButton onClick={() => setShowCreateModal(true)}>+ New Note</PrimaryButton>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-message">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="empty-message">No internal notes yet. Add one to document case details.</div>
        ) : (
          <div className="notes-list">
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                currentUserId={user?.id}
                onEdit={() => setEditingNote(note)}
                onDelete={() => handleNoteDeleted(note.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateNoteModal
          caseId={caseId}
          onClose={() => setShowCreateModal(false)}
          onNoteCreated={handleNoteCreated}
        />
      )}

      {editingNote && (
        <EditNoteModal
          note={editingNote}
          currentUserId={user?.id}
          onClose={() => setEditingNote(null)}
          onNoteUpdated={handleNoteUpdated}
        />
      )}
    </div>
  );
};

export default NotesTab;
