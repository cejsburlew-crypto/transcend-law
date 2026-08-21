// Transcend Law - Landing Page
// Public-facing landing page before authentication

import React, { useState } from 'react';
import './Landing.css';
import { useLanguage } from '../context/LanguageContext';

interface LandingProps {
  onGetStarted?: () => void;
  onRequestDemo?: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onRequestDemo }) => {
  const { t } = useLanguage();
  const [demoModal, setDemoModal] = useState(false);

  React.useEffect(() => {
    // Ensure light mode only
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

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
          <h1>{t('landing.heroTitle')}</h1>
          <p>{t('landing.heroSubtitle')}</p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={onGetStarted}>
              {t('landing.heroPrimary')}
            </button>
            <button className="btn-hero-secondary" onClick={() => setDemoModal(true)}>
              {t('landing.heroSecondary')}
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-container">
          <h2>{t('landing.featuresTitle')}</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>{t('landing.f1Title')}</h3>
              <p>{t('landing.f1Body')}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>{t('landing.f2Title')}</h3>
              <p>{t('landing.f2Body')}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>{t('landing.f3Title')}</h3>
              <p>{t('landing.f3Body')}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>{t('landing.f4Title')}</h3>
              <p>{t('landing.f4Body')}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>{t('landing.f5Title')}</h3>
              <p>{t('landing.f5Body')}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>{t('landing.f6Title')}</h3>
              <p>{t('landing.f6Body')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="services">
        <div className="section-container">
          <h2>{t('landing.servicesTitle')}</h2>
          <p className="section-subtitle">{t('landing.servicesSubtitle')}</p>
          <div className="services-grid">
            <div className="service-item">
              <span className="service-icon">👨‍⚖️</span>
              <h4>{t('services.criminalDefense')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">👰</span>
              <h4>{t('services.familyLaw')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">🏢</span>
              <h4>{t('services.corporateLaw')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">🏠</span>
              <h4>{t('services.realEstateLaw')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">💼</span>
              <h4>{t('services.employmentLaw')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">💔</span>
              <h4>{t('services.personalInjury')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">📋</span>
              <h4>{t('services.contractLaw')}</h4>
            </div>
            <div className="service-item">
              <span className="service-icon">⚙️</span>
              <h4>{t('landing.workersComp')}</h4>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="section-container">
          <h2>{t('landing.howTitle')}</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>{t('landing.s1Title')}</h3>
              <p>{t('landing.s1Body')}</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>{t('landing.s2Title')}</h3>
              <p>{t('landing.s2Body')}</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>{t('landing.s3Title')}</h3>
              <p>{t('landing.s3Body')}</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>{t('landing.s4Title')}</h3>
              <p>{t('landing.s4Body')}</p>
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
              <div className="stat-label">{t('landing.statActiveCases')}</div>
            </div>
            <div className="stat">
              <div className="stat-value">15,000+</div>
              <div className="stat-label">{t('landing.statVerifiedAttorneys')}</div>
            </div>
            <div className="stat">
              <div className="stat-value">4.8★</div>
              <div className="stat-label">{t('landing.statAverageRating')}</div>
            </div>
            <div className="stat">
              <div className="stat-value">$500M+</div>
              <div className="stat-label">{t('landing.statCasesResolved')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="cta-section">
        <div className="cta-container">
          <h2>{t('landing.ctaTitle')}</h2>
          <p>{t('landing.ctaBody')}</p>
          <button className="btn-cta-primary" onClick={onGetStarted}>
            {t('landing.ctaButton')}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-section">
            <h4>Transcend Law</h4>
            <p>{t('landing.footerTagline')}</p>
          </div>
          <div className="footer-section">
            <h4>{t('landing.footerQuickLinks')}</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>{t('landing.footerLegal')}</h4>
            <ul>
              <li><a href="/privacy">{t('landing.footerPrivacy')}</a></li>
              <li><a href="/terms">{t('landing.footerTerms')}</a></li>
              <li><a href="/contact">{t('landing.footerContact')}</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>{t('landing.footerOtherTools')}</h4>
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
