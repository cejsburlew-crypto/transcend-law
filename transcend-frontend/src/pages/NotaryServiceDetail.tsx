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
  const [notaryList, setNotaryList] = useState<Notary[]>([
    {
      id: 'n1',
      name: 'Maria Rodriguez',
      certificationLevel: 'Certified Signing Agent',
      rating: 4.9,
      reviews: 287,
      availableToday: true,
      nextAvailable: '2 hours',
      location: 'Within 15 miles',
      responseTime: '< 30 min',
      specialties: ['Loan Signing', 'Mortgage Documents', 'Power of Attorney'],
    },
    {
      id: 'n2',
      name: 'James Wilson',
      certificationLevel: 'Mobile Notary',
      rating: 4.8,
      reviews: 156,
      availableToday: true,
      nextAvailable: '1 hour',
      location: 'Within 20 miles',
      responseTime: '< 45 min',
      specialties: ['General Notarization', 'Affidavits', 'Document Authentication'],
    },
    {
      id: 'n3',
      name: 'Sarah Johnson',
      certificationLevel: 'eNotary',
      rating: 4.7,
      reviews: 342,
      availableToday: true,
      nextAvailable: 'Now',
      location: 'Remote (Video)',
      responseTime: '< 10 min',
      specialties: ['Remote Video Notarization', 'Multi-State RON', 'Digital Signatures'],
    },
  ]);

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
        <ContactsGrid
          title="🔍 Available Notaries"
          subtitle="Top-rated professionals ready to help you"
          contacts={notaryList.map(notary => ({
            id: notary.id,
            name: notary.name,
            title: notary.certificationLevel,
            state: 'CA',
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
