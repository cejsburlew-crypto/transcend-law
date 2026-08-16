import React, { useState } from 'react';
import type { NotaryService } from './NotaryServices';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { NOTARIES_BY_STATE } from '../data/contacts';
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
  const [selectedState] = useState('CA');

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const stateNotaries = (NOTARIES_BY_STATE[selectedState] || []).map((notary: any) => ({
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
      setNotaryList(stateNotaries);
    } catch (err) {
      console.error('Error loading notaries:', err);
      setError('Failed to load notaries');
      setNotaryList([]);
    } finally {
      setLoading(false);
    }
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
        <h2>📋 Available Notaries</h2>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          Browse all available notaries. Contact them individually or send your request to all at once.
        </p>
        <button
          onClick={() => console.log('Send to all notaries')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '20px'
          }}
        >
          📧 Send to All Notaries at Once
        </button>
        <ContactsGrid
          contacts={(NOTARIES_BY_STATE['CA'] || []).map(notary => ({
            id: notary.id,
            name: notary.name,
            title: notary.certificationLevel,
            state: 'CA',
            rating: notary.rating,
            reviews: notary.reviews,
            verified: notary.rating >= 4.7,
            badges: notary.specialties ? notary.specialties.slice(0, 1) : ['Notarization'],
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
            console.log('Contacting notary:', contactId);
          }}
        />
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
