import React, { useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed' | 'on_hold';
  priority?: 'high' | 'medium' | 'low';
  assigned_to?: string;
}

interface TaskEditModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: () => void;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, onClose, onTaskUpdated }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
    status: task.status,
    priority: task.priority || 'medium' as 'high' | 'medium' | 'low',
    assigned_to: task.assigned_to || ''
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
      await api.updateTask(
        task.id,
        {
          title: formData.title,
          description: formData.description || undefined,
          due_date: formData.due_date || undefined,
          status: formData.status,
          priority: formData.priority,
          assigned_to: formData.assigned_to || undefined
        },
        token
      );
      onTaskUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Task</h2>
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
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
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

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Assigned To</label>
              <input
                type="text"
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
              />
            </div>
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

export default TaskEditModal;
