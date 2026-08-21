import React from 'react';

interface NoteCardProps {
  note: {
    id: string;
    from_user: string;
    body: string;
    created_at: string;
    updated_at?: string;
  };
  currentUserId?: string;
  onEdit: () => void;
  onDelete: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, currentUserId, onEdit, onDelete }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOwnNote = currentUserId && note.from_user === currentUserId;
  const isEdited = note.updated_at && note.updated_at !== note.created_at;

  return (
    <div className="note-card">
      <div className="note-header">
        <div className="note-meta">
          <span className="note-author">👤 {note.from_user}</span>
          <span className="note-timestamp">
            {formatDate(note.created_at)}
            {isEdited && ' (edited)'}
          </span>
        </div>
        {isOwnNote && (
          <div className="note-actions">
            <button className="note-action-btn note-edit-btn" onClick={onEdit} title="Edit note">
              ✎ Edit
            </button>
            <button className="note-action-btn note-delete-btn" onClick={onDelete} title="Delete note">
              🗑 Delete
            </button>
          </div>
        )}
      </div>

      <div className="note-body">
        {note.body.split('\n').map((line, idx) => (
          <p key={idx}>{line || <br />}</p>
        ))}
      </div>
    </div>
  );
};

export default NoteCard;
