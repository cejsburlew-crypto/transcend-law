// PersonaSwitcher Component
// Allows users to switch between personas (Client, Lawyer, Paralegal, etc.)

import React, { useState, useEffect } from 'react';
import './PersonaSwitcher.css';

interface Persona {
  id: number;
  persona_key: string;
  persona_name: string;
  icon: string;
  can_hire: boolean;
  can_be_hired: boolean;
}

interface PersonaSwitcherProps {
  currentPersonaId: number;
  onPersonaChange: (personaId: number, personaName: string, icon: string) => void;
  className?: string;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({
  currentPersonaId,
  onPersonaChange,
  className = '',
}) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);

  useEffect(() => {
    fetchPersonas();
  }, []);

  useEffect(() => {
    if (personas.length > 0) {
      const current = personas.find((p) => p.id === currentPersonaId);
      setCurrentPersona(current || personas[0]);
    }
  }, [currentPersonaId, personas]);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v2/personas');
      const data = await response.json();

      if (data.success) {
        setPersonas(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch personas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaSelect = (persona: Persona) => {
    setCurrentPersona(persona);
    onPersonaChange(persona.id, persona.persona_name, persona.icon);
    setIsOpen(false);
  };

  if (loading) {
    return (
      <div className={`persona-switcher ${className}`}>
        <div className="persona-button loading">Loading personas...</div>
      </div>
    );
  }

  if (!currentPersona) {
    return null;
  }

  return (
    <div className={`persona-switcher ${className}`}>
      <button
        className="persona-button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Current: ${currentPersona.persona_name}`}
      >
        <span className="persona-icon">{currentPersona.icon}</span>
        <span className="persona-name">{currentPersona.persona_name}</span>
        <span className="persona-chevron">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <>
          <div className="persona-overlay" onClick={() => setIsOpen(false)} />
          <div className="persona-menu">
            <div className="persona-menu-header">
              <span className="menu-title">Switch Persona</span>
              <button
                className="menu-close"
                onClick={() => setIsOpen(false)}
                title="Close menu"
              >
                ✕
              </button>
            </div>

            <div className="persona-list">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  className={`persona-option ${
                    persona.id === currentPersona.id ? 'active' : ''
                  }`}
                  onClick={() => handlePersonaSelect(persona)}
                  title={persona.persona_name}
                >
                  <span className="option-icon">{persona.icon}</span>
                  <span className="option-name">{persona.persona_name}</span>
                  {persona.id === currentPersona.id && (
                    <span className="option-checkmark">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="persona-menu-footer">
              <p className="footer-hint">
                Your persona determines which services you can access and hire
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PersonaSwitcher;
