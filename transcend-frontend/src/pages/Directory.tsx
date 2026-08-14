import React, { useState } from 'react';
import './Directory.css';

export const Directory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedPractice, setSelectedPractice] = useState('');

  const professionals = [
    { id: 1, name: 'John Smith', state: 'CA', practice: 'Corporate Law', rating: 4.8, cases: 245 },
    { id: 2, name: 'Sarah Johnson', state: 'NY', practice: 'Litigation', rating: 4.9, cases: 312 },
    { id: 3, name: 'Michael Chen', state: 'TX', practice: 'Patent Law', rating: 4.7, cases: 189 },
    { id: 4, name: 'Emily Rodriguez', state: 'FL', practice: 'Real Estate', rating: 4.6, cases: 267 },
    { id: 5, name: 'David Wilson', state: 'IL', practice: 'Family Law', rating: 4.8, cases: 401 },
  ];

  const states = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA'];
  const practices = ['Corporate Law', 'Litigation', 'Patent Law', 'Real Estate', 'Family Law', 'Tax Law'];

  const filtered = professionals.filter(p =>
    (searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedState === '' || p.state === selectedState) &&
    (selectedPractice === '' || p.practice === selectedPractice)
  );

  return (
    <div className="directory-container">
      <h2>👥 Professional Directory</h2>
      <p>Search and connect with 2.6M+ legal professionals</p>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="filter-select">
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={selectedPractice} onChange={(e) => setSelectedPractice(e.target.value)} className="filter-select">
          <option value="">All Practice Areas</option>
          {practices.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="results-info">
        Showing {filtered.length} professional{filtered.length !== 1 ? 's' : ''}
      </div>

      <div className="professionals-grid">
        {filtered.map(prof => (
          <div key={prof.id} className="professional-card">
            <div className="prof-header">
              <h3>{prof.name}</h3>
              <span className="rating">⭐ {prof.rating}</span>
            </div>
            <p className="practice">{prof.practice}</p>
            <p className="location">📍 {prof.state}</p>
            <p className="cases">Cases Completed: {prof.cases}</p>
            <button className="contact-btn">Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
};
