import React, { useState } from 'react';
import type { NotaryService } from './NotaryServices';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import './NotaryServiceDetail.css';

interface Notary {
  id: string;
  name: string;
  certificationLevel: string;
  rating: number;
  reviews: number;
  availableToday: boolean;
  nextAvailable: string;
  location: string;
  responseTime: string;
  specialties: string[];  // e.g., ["Loan Signing", "Power of Attorney", "Apostille"]
}

interface NotaryServiceDetailProps {
  service: NotaryService;
  onBack: () => void;
}

export const NotaryServiceDetail: React.FC<NotaryServiceDetailProps> = ({ service, onBack }) => {
  const [showBooking, setShowBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState('today');
  const [selectedTime, setSelectedTime] = useState('');
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());
  const [notaryList, setNotaryList] = useState<Notary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState('CA');

  React.useEffect(() => {
    const fetchNotaries = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          state: selectedState,
          limit: '50',
        });

        const response = await fetch(`/api/v2/notaries?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch notaries');
        }

        const data = await response.json();
        const notaries = (data.data || []).map((notary: any) => ({
          id: notary.id,
          name: notary.name,
          certificationLevel: notary.certificationLevel,
          rating: notary.rating,
          reviews: notary.reviews,
          availableToday: true,
          nextAvailable: '< 1 hour',
          location: `${notary.city}, ${notary.state}`,
          responseTime: '< 30 min',
          specialties: notary.specialties || ['Notarization'],
        }));
        setNotaryList(notaries);
      } catch (err) {
        console.error('Error fetching notaries:', err);
        setError(err instanceof Error ? err.message : 'Failed to load notaries');
        setNotaryList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotaries();
  }, [selectedState]);

  const timeSlots = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM'];

  return (
    <div className="notary-detail-container">
      <button className="back-btn" onClick={onBack}>← Back to Services</button>

      {/* Header */}
      <div className="notary-detail-header">
        <h1>
          <span className="icon">{service.icon}</span>
          {service.name}
        </h1>
        <p className="main-description">{service.description}</p>

        <div className="service-info">
          <span className="info-item">
            <strong>⏱️ Average Time:</strong> {service.avgTime}
          </span>
          <span className="info-item">
            <strong>💰 Average Cost:</strong> {service.avgCost}
          </span>
          <span className="info-item">
            <strong>⚡ Availability:</strong>
            <span className={`badge ${service.availability.toLowerCase().replace('/', '-')}`}>
              {service.availability}
            </span>
          </span>
        </div>
      </div>

      {/* Examples */}
      <div className="examples-section">
        <h2>📋 What We Can Notarize</h2>
        <div className="examples-grid">
          {service.examples.map((example, idx) => (
            <div key={idx} className="example-card">
              <span className="example-icon">✓</span>
              <p>{example}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Book Button */}
      <div className="booking-section">
        <button
          className="quick-book-btn"
          onClick={() => setShowBooking(!showBooking)}
        >
          {showBooking ? '✕ Close' : '⚡'} Quick Book Now
        </button>

        {showBooking && (
          <div className="booking-form-container">
            <div className="booking-form">
              <h3>Schedule Your Notarization</h3>

              <div className="form-group">
                <label>Select Date</label>
                <div className="date-options">
                  <button
                    className={`date-btn ${selectedDate === 'today' ? 'active' : ''}`}
                    onClick={() => setSelectedDate('today')}
                  >
                    Today
                  </button>
                  <button
                    className={`date-btn ${selectedDate === 'tomorrow' ? 'active' : ''}`}
                    onClick={() => setSelectedDate('tomorrow')}
                  >
                    Tomorrow
                  </button>
                  <button
                    className={`date-btn ${selectedDate === 'later' ? 'active' : ''}`}
                    onClick={() => setSelectedDate('later')}
                  >
                    Later This Week
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Select Time</label>
                <div className="time-grid">
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      className={`time-btn ${selectedTime === time ? 'active' : ''}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="continue-btn">
                Continue to Notary Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Available Notaries */}
      <div className="notaries-section">
        {loading && <p style={{ textAlign: 'center', color: '#666' }}>Loading notaries...</p>}
        {error && <p style={{ textAlign: 'center', color: '#d32f2f' }}>Error: {error}</p>}
        {!loading && notaryList.length > 0 && (
          <ContactsGrid
            title="🔍 Available Notaries"
            subtitle="Top-rated professionals ready to help you"
            contacts={notaryList.map(notary => ({
              id: notary.id,
              name: notary.name,
              title: notary.certificationLevel,
              state: selectedState,
              rating: notary.rating,
              reviews: notary.reviews,
              verified: notary.rating >= 4.7,
              badges: notary.specialties.slice(0, 1),
            } as ContactProfile))}
            publicProfiles={publicProfiles}
            onProfileToggle={(contactId) => {
              const newPublic = new Set(publicProfiles);
              if (newPublic.has(contactId)) {
                newPublic.delete(contactId);
              } else {
                newPublic.add(contactId);
              }
              setPublicProfiles(newPublic);
            }}
            onCommunicate={(contactId) => {
              console.log('Booking notary:', contactId);
            }}
          />
        )}
        {!loading && notaryList.length === 0 && !error && (
          <p style={{ textAlign: 'center', color: '#666' }}>No notaries available.</p>
        )}
      </div>

      {/* Why Choose Us */}
      <div className="benefits-section">
        <h3>✨ Why Choose Our Notaries?</h3>
        <ul>
          <li>✓ Available same-day, 24/7, or on your schedule</li>
          <li>✓ Mobile, online (eNotary), or in-person services</li>
          <li>✓ Licensed, bonded, and insured professionals</li>
          <li>✓ Average response time under 1 hour</li>
          <li>✓ No travel fees for local area services</li>
          <li>✓ Transparent pricing with no hidden charges</li>
        </ul>
      </div>
    </div>
  );
};
