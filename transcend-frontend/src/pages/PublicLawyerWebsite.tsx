import React, { useState, useEffect } from 'react';
import './PublicLawyerWebsite.css';

interface LawyerProfile {
  companyName: string;
  lawyerName: string;
  bio: string;
  email: string;
  phone: string;
  licenseNumber?: string;
  yearsExperience?: number;
  specializations: string[];
  officeAddress?: string;
  profilePicture?: string;
  services: string[];
  testimonials: Array<{
    clientName: string;
    rating: number;
    review: string;
    date: string;
  }>;
  website: {
    backgroundColor: string;
    accentColor: string;
    logoUrl?: string;
    headerImage?: string;
  };
}

interface Props {
  subdomain: string;
}

export default function PublicLawyerWebsite({ subdomain }: Props) {
  const [profile, setProfile] = useState<LawyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactFormData, setContactFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    serviceInterest: '',
  });
  const [contactSuccess, setContactSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [subdomain]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/public/${subdomain}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.website);
        trackPageView();
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackPageView = async () => {
    try {
      await fetch(`/api/public/${subdomain}/track/pageview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralSource: document.referrer || 'direct',
        }),
      });
    } catch (error) {
      // Silent fail - don't impact user experience
    }
  };

  const handleServiceClick = async (service: string) => {
    try {
      await fetch(`/api/public/${subdomain}/track/service-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: service }),
      });
    } catch (error) {
      // Silent fail
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/public/${subdomain}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactFormData),
      });

      if (response.ok) {
        setContactSuccess(true);
        setContactFormData({ name: '', email: '', phone: '', message: '', serviceInterest: '' });
        setTimeout(() => setContactSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to submit contact form:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!profile) {
    return (
      <div className="not-found">
        <h1>Website Not Found</h1>
        <p>This lawyer's website is no longer available.</p>
      </div>
    );
  }

  const avgRating =
    profile.testimonials.length > 0
      ? (profile.testimonials.reduce((sum, t) => sum + t.rating, 0) / profile.testimonials.length).toFixed(1)
      : null;

  return (
    <div className="public-lawyer-website">
      {/* Hero Section */}
      <div className="hero-section" style={{ backgroundColor: profile.website.accentColor }}>
        <div className="hero-content">
          {profile.profilePicture && (
            <img src={profile.profilePicture} alt={profile.lawyerName} className="profile-image" />
          )}
          <h1>{profile.lawyerName}</h1>
          <p className="firm-name">{profile.companyName}</p>
          {profile.specializations.length > 0 && (
            <p className="specializations">{profile.specializations.join(' • ')}</p>
          )}
        </div>
      </div>

      <div className="website-container">
        {/* Main Content */}
        <div className="content-grid">
          {/* About Section */}
          <section className="about-section">
            <h2>About</h2>
            <p>{profile.bio}</p>

            {profile.licenseNumber && (
              <div className="detail">
                <strong>License:</strong> {profile.licenseNumber}
              </div>
            )}

            {profile.yearsExperience && (
              <div className="detail">
                <strong>Experience:</strong> {profile.yearsExperience} years
              </div>
            )}

            {profile.officeAddress && (
              <div className="detail">
                <strong>Office:</strong> {profile.officeAddress}
              </div>
            )}

            <div className="contact-info">
              <a href={`tel:${profile.phone}`} className="contact-btn">
                📞 {profile.phone}
              </a>
              <a href={`mailto:${profile.email}`} className="contact-btn">
                ✉️ {profile.email}
              </a>
            </div>
          </section>

          {/* Services Section */}
          <section className="services-section">
            <h2>Practice Areas</h2>
            <div className="services-grid">
              {profile.services.map((service) => (
                <button
                  key={service}
                  className="service-card"
                  onClick={() => handleServiceClick(service)}
                  style={{ borderColor: profile.website.accentColor }}
                >
                  {service}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Testimonials Section */}
        {profile.testimonials.length > 0 && (
          <section className="testimonials-section">
            <h2>Client Reviews</h2>
            {avgRating && (
              <div className="rating-summary">
                <span className="stars">{'★'.repeat(Math.round(parseFloat(avgRating)))}</span>
                <span className="rating-text">{avgRating} out of 5 ({profile.testimonials.length} reviews)</span>
              </div>
            )}
            <div className="testimonials-grid">
              {profile.testimonials.map((testimonial, idx) => (
                <div key={idx} className="testimonial-card">
                  <div className="stars">{'★'.repeat(testimonial.rating)}</div>
                  <p className="review">{testimonial.review}</p>
                  <p className="client-name">— {testimonial.clientName}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact Form */}
        <section className="contact-section">
          <h2>Get In Touch</h2>
          <form onSubmit={handleContactSubmit} className="contact-form">
            {contactSuccess && (
              <div className="success-message">
                ✓ Message sent! {profile.lawyerName} will contact you soon.
              </div>
            )}

            <div className="form-group">
              <label>Your Name *</label>
              <input
                type="text"
                value={contactFormData.name}
                onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={contactFormData.email}
                onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={contactFormData.phone}
                onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Service of Interest</label>
              <select
                value={contactFormData.serviceInterest}
                onChange={(e) => setContactFormData({ ...contactFormData, serviceInterest: e.target.value })}
                className="form-select"
              >
                <option value="">Select a service...</option>
                {profile.services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea
                value={contactFormData.message}
                onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                required
                placeholder="Tell us about your legal matter..."
                rows={5}
                className="form-textarea"
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              style={{ backgroundColor: profile.website.accentColor }}
            >
              Send Message
            </button>
          </form>
        </section>

        {/* Footer */}
        <footer className="website-footer">
          <p>
            Website powered by <strong>Transcend Law</strong> — Find more lawyers at{' '}
            <a href="https://transcend-law.com">transcend-law.com</a>
          </p>
          <p className="disclaimer">
            This website does not create an attorney-client relationship. Prior results do not guarantee similar outcomes.
          </p>
        </footer>
      </div>
    </div>
  );
}
