import React, { useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';

interface CreateTaskModalProps {
  caseId: string;
  onClose: () => void;
  onTaskCreated: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ caseId, onClose, onTaskCreated }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    assigned_to: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.createTask(
        {
          case_id: caseId,
          title: formData.title,
          description: formData.description || undefined,
          due_date: formData.due_date || undefined,
          priority: formData.priority,
          assigned_to: formData.assigned_to || undefined
        },
        token
      );
      onTaskCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Task</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Task title"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Task details"
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Assigned To</label>
            <input
              type="text"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              placeholder="Attorney or paralegal name"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-cancel-btn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
