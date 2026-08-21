import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { PrimaryButton } from '@/components/UI';
import './Appointments.css';

interface Appointment {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  appointment_type?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees: any[];
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at: string;
}

interface AppointmentsTabProps {
  caseId: string;
}

const AppointmentsTab: React.FC<AppointmentsTabProps> = ({ caseId }) => {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, [caseId, statusFilter]);

  const fetchAppointments = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await api.getAppointmentsByCase(caseId, token, status);
      setAppointments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return '#4F46E5';
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <div className="appointments-container">
      <div className="appointments-header">
        <PrimaryButton
          onClick={() => setShowCreateModal(true)}
          className="new-appointment-btn"
        >
          + New Appointment
        </PrimaryButton>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="status-filters">
        <button
          className={`status-filter ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All ({appointments.length})
        </button>
        <button
          className={`status-filter ${statusFilter === 'scheduled' ? 'active' : ''}`}
          onClick={() => setStatusFilter('scheduled')}
        >
          Scheduled ({appointments.filter(a => a.status === 'scheduled').length})
        </button>
        <button
          className={`status-filter ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('completed')}
        >
          Completed ({appointments.filter(a => a.status === 'completed').length})
        </button>
        <button
          className={`status-filter ${statusFilter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setStatusFilter('cancelled')}
        >
          Cancelled ({appointments.filter(a => a.status === 'cancelled').length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <p>No appointments scheduled for this case yet.</p>
          <p>Click "New Appointment" to schedule one.</p>
        </div>
      ) : (
        <div className="appointments-timeline">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="appointment-card"
              style={{ borderLeftColor: getStatusColor(appointment.status) }}
            >
              <div className="appointment-header">
                <h3>{appointment.title}</h3>
                <span className={`status-badge status-${appointment.status}`}>
                  {appointment.status}
                </span>
              </div>

              <div className="appointment-details">
                <div className="detail-row">
                  <span className="detail-label">Time:</span>
                  <span className="detail-value">{formatDateTime(appointment.start_time)}</span>
                </div>

                {appointment.location && (
                  <div className="detail-row">
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">{appointment.location}</span>
                  </div>
                )}

                {appointment.appointment_type && (
                  <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{appointment.appointment_type}</span>
                  </div>
                )}

                {appointment.description && (
                  <div className="detail-row">
                    <span className="detail-label">Description:</span>
                    <span className="detail-value">{appointment.description}</span>
                  </div>
                )}

                {appointment.attendees && appointment.attendees.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Attendees:</span>
                    <span className="detail-value">
                      {appointment.attendees.map((a: any) => a.name || a).join(', ')}
                    </span>
                  </div>
                )}

                {appointment.notes && (
                  <div className="detail-row">
                    <span className="detail-label">Notes:</span>
                    <span className="detail-value">{appointment.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentsTab;
