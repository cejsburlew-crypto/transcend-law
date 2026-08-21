import React from 'react';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    status: 'open' | 'in_progress' | 'completed' | 'on_hold';
    priority?: 'high' | 'medium' | 'low';
    assigned_to?: string;
  };
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onComplete, onDelete }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return '#dc2626'; // red
      case 'medium':
        return '#f59e0b'; // amber
      case 'low':
        return '#16a34a'; // green
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className={`task-card task-status-${task.status}`}>
      <div className="task-header">
        <div className="task-title-section">
          <div className="task-priority-indicator" style={{ backgroundColor: getPriorityColor(task.priority) }} />
          <h3 className="task-title">{task.title}</h3>
        </div>
        <span className={`task-status-badge task-status-${task.status}`}>
          {task.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-meta">
        {task.due_date && (
          <span className="task-due-date">
            📅 {formatDate(task.due_date)}
          </span>
        )}
        {task.assigned_to && (
          <span className="task-assigned">
            👤 {task.assigned_to}
          </span>
        )}
      </div>

      <div className="task-actions">
        {task.status !== 'completed' && (
          <button className="task-action-btn task-complete-btn" onClick={onComplete} title="Mark as complete">
            ✓ Complete
          </button>
        )}
        <button className="task-action-btn task-edit-btn" onClick={onEdit} title="Edit task">
          ✎ Edit
        </button>
        <button className="task-action-btn task-delete-btn" onClick={onDelete} title="Delete task">
          🗑 Delete
        </button>
      </div>
    </div>
  );
};

export default TaskCard;
