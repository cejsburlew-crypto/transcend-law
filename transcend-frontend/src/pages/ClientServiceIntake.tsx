import React, { useState } from 'react';
import { ServiceSelection } from './ServiceSelection';
import { ClientIntake } from './ClientIntake';
import './ServiceSelection.css';

export const ClientServiceIntake: React.FC = () => {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const handleBackToServices = () => {
    setSelectedService(null);
  };

  if (selectedService === 'Lawyer') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={handleBackToServices}
          style={{
            alignSelf: 'flex-start',
            marginBottom: '20px',
            marginLeft: '20px',
            marginTop: '20px',
            padding: '8px 16px',
            background: '#f5f7fa',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            zIndex: 10
          }}
        >
          ← Back to Services
        </button>
        <ClientIntake />
      </div>
    );
  }

  if (selectedService) {
    return (
      <div style={{ padding: '40px 20px' }}>
        <button
          onClick={handleBackToServices}
          style={{
            marginBottom: '30px',
            padding: '8px 16px',
            background: '#f5f7fa',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ← Back to Services
        </button>

        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '8px',
            border: '1px solid #e1e8ed'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>Request {selectedService} Services</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Tell us about your {selectedService.toLowerCase()} needs so we can connect you with the right professional.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                  Service Title *
                </label>
                <input
                  type="text"
                  placeholder={`e.g., Need ${selectedService.toLowerCase()} for...`}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                  Detailed Description *
                </label>
                <textarea
                  placeholder={`Describe what ${selectedService.toLowerCase()} services you need...`}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                    State/Location *
                  </label>
                  <select style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}>
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                    <option value="IL">Illinois</option>
                    <option value="PA">Pennsylvania</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                    Urgency Level *
                  </label>
                  <select style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}>
                    <option value="low">Low - Not time-sensitive</option>
                    <option value="medium">Medium - Needs attention soon</option>
                    <option value="high">High - Urgent matter</option>
                    <option value="urgent">Urgent - Immediate action needed</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                  Budget (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., $500 - $2,000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Full name"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <button style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '20px'
              }}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ServiceSelection onSelectService={setSelectedService} />;
};
