// Transcend Law - Landing Page
// Public-facing landing page before authentication

import React, { useState } from 'react';
import './Landing.css';

interface LandingProps {
  onGetStarted?: () => void;
  onRequestDemo?: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onRequestDemo }) => {
  const [demoModal, setDemoModal] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const newIsDark = !isDark;
    if (newIsDark) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.setAttribute('data-theme', 'light');
    }
    setIsDark(newIsDark);
  };

  return (
    <div className="landing-page">
      {/* Tagline Bar */}
      <div className="tagline-bar">
        <p className="tagline">
          ⚖️ Your Single Source for Legal Truth • Transparent • Verified • Secure
        </p>
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">⚖️</span>
            <span className="logo-text">TRANSCEND LAW</span>
          </div>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <div className="nav-actions">
            <button
              className="btn-icon"
              onClick={toggleDarkMode}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ padding: '8px 12px', background: 'transparent', border: '1px solid currentColor', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button className="btn-secondary" onClick={() => setDemoModal(true)}>
              Request Demo
            </button>
            <button className="btn-primary" onClick={onGetStarted}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Find Your Legal Solution</h1>
          <p>Connect with qualified attorneys for any legal matter. Fast, transparent, and secure.</p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={onGetStarted}>
              Get Started Free →
            </button>
            <button className="btn-hero-secondary" onClick={() => setDemoModal(true)}>
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-container">
          <h2>Why Choose Transcend Law</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Smart Matching</h3>
              <p>AI-powered attorney matching based on your specific legal needs and location</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Transparent Pricing</h3>
              <p>Get upfront quotes from multiple attorneys with no hidden fees</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>Verified Professionals</h3>
              <p>All attorneys are verified and licensed with full credential verification</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Fast Response</h3>
              <p>Connect with available attorneys within hours, not days</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>24/7 Access</h3>
              <p>Manage your cases anytime, anywhere with our mobile-friendly platform</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Secure & Private</h3>
              <p>End-to-end encryption ensures your legal matters stay confidential</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="services">
        <div className="section-container">
          <h2>Legal Services We Cover</h2>
          <p className="section-subtitle">From family law to complex litigation, we have attorneys ready to help</p>
          <div className="services-grid">
            <div className="service-item">
              <span className="service-icon">👨‍⚖️</span>
              <h4>Criminal Defense</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">👰</span>
              <h4>Family Law</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">🏢</span>
              <h4>Corporate Law</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">🏠</span>
              <h4>Real Estate</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">💼</span>
              <h4>Employment Law</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">💔</span>
              <h4>Personal Injury</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">📋</span>
              <h4>Contract Law</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">⚙️</span>
              <h4>Workers' Comp</h4>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="section-container">
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Tell Us Your Needs</h3>
              <p>Answer a few questions about your legal matter and budget</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Get Matched</h3>
              <p>We match you with qualified attorneys in your area</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Review Quotes</h3>
              <p>Compare rates and services from multiple attorneys</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Get Legal Help</h3>
              <p>Connect with your chosen attorney and resolve your case</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="section-container">
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-value">50,000+</div>
              <div className="stat-label">Active Cases</div>
            </div>
            <div className="stat">
              <div className="stat-value">15,000+</div>
              <div className="stat-label">Verified Attorneys</div>
            </div>
            <div className="stat">
              <div className="stat-value">4.8★</div>
              <div className="stat-label">Average Rating</div>
            </div>
            <div className="stat">
              <div className="stat-value">$500M+</div>
              <div className="stat-label">Cases Resolved</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="cta-section">
        <div className="cta-container">
          <h2>Ready to Find Your Attorney?</h2>
          <p>Join thousands of people who have resolved their legal matters on Transcend Law</p>
          <button className="btn-cta-primary" onClick={onGetStarted}>
            Get Started Now →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-section">
            <h4>Transcend Law</h4>
            <p>Part of the Transcend Tools suite. Find the legal services you need.</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/contact">Contact Us</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Other Tools</h4>
            <ul>
              <li><a href="https://carrier-nexus.jbca-inc.com">Transcend Trucking</a></li>
              <li><a href="https://transcendtools.com/transcend-pm">Transcend PM</a></li>
              <li><a href="https://transcendtools.com">Transcend Tools</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Transcend Law. All rights reserved. | Part of Transcend Tools</p>
        </div>
      </footer>

      {/* Demo Modal */}
      {demoModal && (
        <div className="modal-overlay" onClick={() => setDemoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDemoModal(false)}>✕</button>
            <h2>Request Demo</h2>
            <form className="demo-form" onSubmit={e => e.preventDefault()}>
              <input type="text" placeholder="First Name" required />
              <input type="text" placeholder="Last Name" required />
              <input type="email" placeholder="Email" required />
              <input type="tel" placeholder="Phone" />
              <textarea placeholder="Tell us about your legal needs..." rows={4}></textarea>
              <button type="submit" className="btn-primary">Request Demo</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
