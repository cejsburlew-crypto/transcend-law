import React, { useState, useRef, useEffect } from 'react';
import { useCurrency, SUPPORTED_CURRENCIES, CurrencyCode } from '../hooks/useCurrency';
import './CurrencySelector.css';

interface CurrencySelectorProps {
  onCurrencyChange?: (currency: CurrencyCode) => void;
  showExchangeRates?: boolean;
  compact?: boolean;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  onCurrencyChange,
  showExchangeRates = false,
  compact = false,
}) => {
  const { currentCurrency, setCurrency, exchangeRates, isLoading, error } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCurrencySelect = (currency: CurrencyCode) => {
    setCurrency(currency);
    setIsOpen(false);
    setSearchTerm('');

    if (onCurrencyChange) {
      onCurrencyChange(currency);
    }
  };

  const currentCurrencyInfo = SUPPORTED_CURRENCIES[currentCurrency];

  // Filter currencies based on search term
  const filteredCurrencies = Object.entries(SUPPORTED_CURRENCIES).filter(
    ([code, info]) =>
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      info.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (compact) {
    return (
      <div className="currency-selector currency-selector--compact">
        <button
          className="currency-selector__button currency-selector__button--compact"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`Current currency: ${currentCurrencyInfo?.name}`}
        >
          <span className="currency-selector__symbol">{currentCurrencyInfo?.symbol}</span>
          <span className="currency-selector__code">{currentCurrency}</span>
        </button>

        {isOpen && (
          <div className="currency-selector__dropdown currency-selector__dropdown--compact">
            <input
              type="text"
              className="currency-selector__search"
              placeholder="Search currencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="currency-selector__list currency-selector__list--compact">
              {filteredCurrencies.map(([code, info]) => (
                <button
                  key={code}
                  className={`currency-selector__item currency-selector__item--compact ${
                    code === currentCurrency ? 'currency-selector__item--active' : ''
                  }`}
                  onClick={() => handleCurrencySelect(code as CurrencyCode)}
                >
                  <span className="currency-selector__item-symbol">{info.symbol}</span>
                  <span className="currency-selector__item-code">{code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="currency-selector" ref={dropdownRef}>
      <div className="currency-selector__header">
        <h3 className="currency-selector__title">Currency</h3>
        {error && <span className="currency-selector__error" aria-live="polite">{error}</span>}
      </div>

      <button
        className="currency-selector__button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Current currency: ${currentCurrencyInfo?.name}, Click to change`}
      >
        <div className="currency-selector__current">
          <span className="currency-selector__symbol">{currentCurrencyInfo?.symbol}</span>
          <div className="currency-selector__text">
            <span className="currency-selector__code">{currentCurrency}</span>
            <span className="currency-selector__name">{currentCurrencyInfo?.name}</span>
          </div>
        </div>
        <svg
          className={`currency-selector__chevron ${isOpen ? 'currency-selector__chevron--open' : ''}`}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="currency-selector__dropdown">
          <input
            type="text"
            className="currency-selector__search"
            placeholder="Search currencies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            aria-label="Search currencies"
          />

          {isLoading && (
            <div className="currency-selector__loading">
              <span className="currency-selector__spinner"></span>
              Loading exchange rates...
            </div>
          )}

          <div className="currency-selector__list">
            {filteredCurrencies.length > 0 ? (
              filteredCurrencies.map(([code, info]) => {
                const rate = exchangeRates[code];
                return (
                  <button
                    key={code}
                    className={`currency-selector__item ${
                      code === currentCurrency ? 'currency-selector__item--active' : ''
                    }`}
                    onClick={() => handleCurrencySelect(code as CurrencyCode)}
                  >
                    <div className="currency-selector__item-left">
                      <span className="currency-selector__item-symbol">{info.symbol}</span>
                      <div className="currency-selector__item-info">
                        <span className="currency-selector__item-code">{code}</span>
                        <span className="currency-selector__item-name">{info.name}</span>
                      </div>
                    </div>

                    {showExchangeRates && rate && (
                      <span className="currency-selector__item-rate">
                        1 USD = {rate.toFixed(2)} {code}
                      </span>
                    )}

                    {code === currentCurrency && (
                      <svg
                        className="currency-selector__checkmark"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="currency-selector__no-results">
                No currencies found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrencySelector;
