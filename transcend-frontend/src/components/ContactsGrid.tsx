import React, { useState } from 'react';
import { ContactCard, type ContactProfile } from './ContactCard';
import './ContactsGrid.css';

interface ContactsGridProps {
  contacts: ContactProfile[];
  title?: string;
  subtitle?: string;
  onContactSelect?: (contact: ContactProfile) => void;
  onProfileToggle?: (contactId: string) => void;
  onCommunicate?: (contactId: string) => void;
  publicProfiles?: Set<string>;
}

export const ContactsGrid: React.FC<ContactsGridProps> = ({
  contacts,
  title,
  subtitle,
  onContactSelect,
  onProfileToggle,
  onCommunicate,
  publicProfiles = new Set(),
}) => {
  const [sortBy, setSortBy] = useState<'rating' | 'experience' | 'hourly_rate'>('rating');
  const [filterRating, setFilterRating] = useState<number>(0);

  const sortedAndFilteredContacts = [...contacts]
    .filter((c) => c.rating >= filterRating)
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'experience':
          return (b.yearsExperience || 0) - (a.yearsExperience || 0);
        case 'hourly_rate':
          return (a.hourlyRate || 0) - (b.hourlyRate || 0);
        default:
          return 0;
      }
    });

  return (
    <div className="contacts-grid-wrapper">
      {/* Header */}
      {(title || subtitle) && (
        <div className="contacts-header">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}

      {/* Controls */}
      <div className="contacts-controls">
        <div className="sort-control">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="rating">⭐ Rating (High to Low)</option>
            <option value="experience">📚 Years Experience (High to Low)</option>
            <option value="hourly_rate">💰 Hourly Rate (Low to High)</option>
          </select>
        </div>

        <div className="filter-control">
          <label>Min Rating:</label>
          <select value={filterRating} onChange={(e) => setFilterRating(Number(e.target.value))}>
            <option value={0}>Any</option>
            <option value={3.5}>3.5+</option>
            <option value={4.0}>4.0+</option>
            <option value={4.5}>4.5+</option>
            <option value={4.8}>4.8+</option>
          </select>
        </div>

        <div className="results-count">
          Showing <strong>{sortedAndFilteredContacts.length}</strong> providers
        </div>
      </div>

      {/* Grid */}
      {sortedAndFilteredContacts.length > 0 ? (
        <div className="contacts-grid">
          {sortedAndFilteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isPublic={publicProfiles.has(contact.id)}
              onProfileToggle={onProfileToggle}
              onCommunicate={onCommunicate}
              onSelect={onContactSelect}
            />
          ))}
        </div>
      ) : (
        <div className="no-results">
          <p>No providers found matching your filters.</p>
        </div>
      )}
    </div>
  );
};

export default ContactsGrid;
