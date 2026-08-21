import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';
import TaskCard from '@/pages/TaskCard';
import CreateTaskModal from '@/pages/CreateTaskModal';
import TaskEditModal from '@/pages/TaskEditModal';

interface Task {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed' | 'on_hold';
  priority?: 'high' | 'medium' | 'low';
  created_by?: string;
  completed_at?: string;
}

interface TasksTabProps {
  caseId: string;
}

const TasksTab: React.FC<TasksTabProps> = ({ caseId }) => {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'on_hold'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [caseId, statusFilter]);

  const fetchTasks = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await api.getTasksByCase(caseId, token, status);
      setTasks(Array.isArray(data) ? data : data.tasks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = () => {
    setShowCreateModal(false);
    fetchTasks();
  };

  const handleTaskUpdated = () => {
    setEditingTask(null);
    fetchTasks();
  };

  const handleTaskCompleted = async (taskId: string) => {
    if (!token) return;
    try {
      await api.completeTask(taskId, token);
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleTaskDeleted = async (taskId: string) => {
    if (!token || !window.confirm('Delete this task?')) return;
    try {
      await api.deleteTask(taskId, token);
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="tab-pane">
      <div className="section">
        <div className="section-header">
          <h2>Tasks</h2>
          <PrimaryButton onClick={() => setShowCreateModal(true)}>+ New Task</PrimaryButton>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Status Filter Buttons */}
        <div className="task-filters">
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({tasks.length})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'open' ? 'active' : ''}`}
            onClick={() => setStatusFilter('open')}
          >
            Open ({statusCounts.open || 0})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
          >
            In Progress ({statusCounts.in_progress || 0})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({statusCounts.completed || 0})
          </button>
          <button
            className={`filter-btn ${statusFilter === 'on_hold' ? 'active' : ''}`}
            onClick={() => setStatusFilter('on_hold')}
          >
            On Hold ({statusCounts.on_hold || 0})
          </button>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="loading-message">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-message">No tasks for this case yet. Create one to get started!</div>
        ) : (
          <div className="tasks-list">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => setEditingTask(task)}
                onComplete={() => handleTaskCompleted(task.id)}
                onDelete={() => handleTaskDeleted(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          caseId={caseId}
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
};

export default TasksTab;
