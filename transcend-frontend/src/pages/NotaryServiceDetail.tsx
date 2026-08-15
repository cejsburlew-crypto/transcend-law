import React, { useState } from 'react';
import type { NotaryService } from './NotaryServices';
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
        <h2>🔍 Available Notaries</h2>
        <p className="section-subtitle">Top-rated professionals ready to help you</p>

        <div className="notaries-grid">
          {notaryList.map(notary => (
            <div key={notary.id} className="notary-card">
              <div className="notary-header">
                <div className="notary-avatar">
                  {notary.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="notary-info">
                  <h4>{notary.name}</h4>
                  <p className="certification">{notary.certificationLevel}</p>
                </div>
              </div>

              <div className="notary-stats">
                <div className="rating-section">
                  <span className="stars">⭐ {notary.rating}</span>
                  <span className="reviews">({notary.reviews} reviews)</span>
                </div>
              </div>

              <div className="notary-details">
                <div className="detail-item">
                  <span className="label">📍 Location:</span>
                  <span className="value">{notary.location}</span>
                </div>
                <div className="detail-item">
                  <span className="label">⏱️ Response:</span>
                  <span className="value">{notary.responseTime}</span>
                </div>
                <div className="detail-item">
                  <span className="label">📅 Available:</span>
                  <span className={`value ${notary.availableToday ? 'available' : ''}`}>
                    {notary.nextAvailable}
                  </span>
                </div>
              </div>

              {notary.specialties.length > 0 && (
                <div className="notary-specialties">
                  <div className="specialties-label">🎯 Specialties:</div>
                  <div className="specialties-list">
                    {notary.specialties.map((specialty, idx) => (
                      <span key={idx} className="specialty-badge">{specialty}</span>
                    ))}
                  </div>
                </div>
              )}

              <button className="book-notary-btn">
                Book {notary.name.split(' ')[0]}
              </button>
            </div>
          ))}
        </div>
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
