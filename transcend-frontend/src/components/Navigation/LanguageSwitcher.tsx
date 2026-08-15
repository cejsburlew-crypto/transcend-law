// Language Switcher
// Toggle between English and Spanish

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './LanguageSwitcher.css';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-switcher">
      <button
        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        title="English"
        aria-label="Switch to English"
      >
        EN
      </button>
      <span className="lang-separator">/</span>
      <button
        className={`lang-btn ${language === 'es' ? 'active' : ''}`}
        onClick={() => setLanguage('es')}
        title="Español"
        aria-label="Switch to Spanish"
      >
        ES
      </button>
    </div>
  );
};

export default LanguageSwitcher;
