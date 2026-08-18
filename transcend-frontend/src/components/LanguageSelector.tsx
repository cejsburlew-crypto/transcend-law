// Global Language Selector
// Support for 16+ languages with search and RTL support

import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './LanguageSelector.css';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, availableLanguages } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Prioritize these 4 languages at the top
  const priorityLanguageCodes = ['en', 'es', 'zh', 'vi'];
  const priorityLanguages = availableLanguages.filter(l => priorityLanguageCodes.includes(l.code));
  const otherLanguages = availableLanguages.filter(l => !priorityLanguageCodes.includes(l.code));

  const currentLanguage = availableLanguages.find(l => l.code === language);

  const searchFilteredLanguages = availableLanguages.filter(
    lang =>
      lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLanguages = searchTerm === ''
    ? [...priorityLanguages, ...otherLanguages]
    : searchFilteredLanguages;

  const handleSelect = (code: string) => {
    setLanguage(code);
    setShowDropdown(false);
    setSearchTerm('');
  };

  return (
    <div className="language-selector-container">
      <button
        className="language-selector-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Select language"
      >
        <span className="language-flag">{currentLanguage?.flag || '🌐'}</span>
        <span className="language-code">{language.toUpperCase()}</span>
      </button>

      {showDropdown && (
        <div className="language-dropdown">
          <div className="language-search">
            <input
              type="text"
              placeholder="🔍 Search languages..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
              className="language-search-input"
            />
          </div>

          <div className="language-list">
            {searchTerm === '' && (
              <>
                <div className="language-group-label">⭐ Recommended</div>
                {priorityLanguages.map(lang => (
                  <button
                    key={lang.code}
                    className={`language-item ${language === lang.code ? 'active' : ''}`}
                    onClick={() => handleSelect(lang.code)}
                  >
                    <span className="lang-flag">{lang.flag}</span>
                    <span className="lang-name">{lang.name}</span>
                    <span className="lang-code">({lang.code})</span>
                    {language === lang.code && <span className="lang-check">✓</span>}
                  </button>
                ))}
                <div className="language-divider" />
                <div className="language-group-label">🌐 All Languages</div>
                {otherLanguages.map(lang => (
                  <button
                    key={lang.code}
                    className={`language-item ${language === lang.code ? 'active' : ''}`}
                    onClick={() => handleSelect(lang.code)}
                  >
                    <span className="lang-flag">{lang.flag}</span>
                    <span className="lang-name">{lang.name}</span>
                    <span className="lang-code">({lang.code})</span>
                    {language === lang.code && <span className="lang-check">✓</span>}
                  </button>
                ))}
              </>
            )}
            {searchTerm !== '' && (
              <>
                {filteredLanguages.map(lang => (
                  <button
                    key={lang.code}
                    className={`language-item ${language === lang.code ? 'active' : ''}`}
                    onClick={() => handleSelect(lang.code)}
                  >
                    <span className="lang-flag">{lang.flag}</span>
                    <span className="lang-name">{lang.name}</span>
                    <span className="lang-code">({lang.code})</span>
                    {language === lang.code && <span className="lang-check">✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>

          {filteredLanguages.length === 0 && (
            <div className="language-empty">
              No languages found
            </div>
          )}

          <div className="language-footer">
            🌐 {filteredLanguages.length} language{filteredLanguages.length !== 1 ? 's' : ''} available
          </div>
        </div>
      )}

      {showDropdown && (
        <div
          className="language-dropdown-overlay"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default LanguageSelector;
