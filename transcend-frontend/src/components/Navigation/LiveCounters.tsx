import React, { useState, useEffect } from 'react';
import './LiveCounters.css';

interface CounterData {
  users: number;
  serviceProviders: number;
  lastUpdated: string;
  scrapingStatus: 'active' | 'idle' | 'error';
}

export default function LiveCounters() {
  const [counters, setCounters] = useState<CounterData>({
    users: 0,
    serviceProviders: 0,
    lastUpdated: new Date().toISOString(),
    scrapingStatus: 'idle',
  });

  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    // Fetch current counts
    const fetchCounts = async () => {
      try {
        const response = await fetch('/api/platform/live-counts');
        if (response.ok) {
          const data = await response.json();

          // Check if numbers changed (trigger animation)
          if (data.users !== counters.users || data.serviceProviders !== counters.serviceProviders) {
            setShowAnimation(true);
            setTimeout(() => setShowAnimation(false), 1000);
          }

          setCounters(data);
        }
      } catch (error) {
        console.error('Failed to fetch counts:', error);
      }
    };

    // Fetch immediately
    fetchCounts();

    // Update every 5 seconds (or when WebSocket updates arrive)
    const interval = setInterval(fetchCounts, 5000);

    // WebSocket for real-time updates
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live-counts`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.users !== counters.users || data.serviceProviders !== counters.serviceProviders) {
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 1000);
      }
      setCounters(data);
    };

    ws.onerror = () => {
      setCounters(prev => ({ ...prev, scrapingStatus: 'error' }));
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [counters.users, counters.serviceProviders]);

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="live-counters">
      {/* Users Counter */}
      {counters.users >= 1_000_000 && (
        <div className={`counter users ${showAnimation ? 'animate' : ''}`}>
          <span className="label">Users</span>
          <span className="number" title={counters.users.toLocaleString()}>
            {formatNumber(counters.users)}
          </span>
        </div>
      )}

      {/* Service Providers Counter */}
      {counters.serviceProviders >= 1_000_000 && (
        <div className={`counter providers ${showAnimation ? 'animate' : ''}`}>
          <span className="label">Service Providers</span>
          <span className="number" title={counters.serviceProviders.toLocaleString()}>
            {formatNumber(counters.serviceProviders)}
          </span>
        </div>
      )}

      {/* Scraping Status Indicator */}
      <div className={`scraping-status ${counters.scrapingStatus}`}>
        <span className="dot" />
        <span className="text">
          {counters.scrapingStatus === 'active' ? 'Scraping Live' :
           counters.scrapingStatus === 'error' ? 'Scraper Paused' :
           'Scraper Ready'}
        </span>
      </div>

      {/* Last Updated */}
      <div className="last-updated">
        Updated: {new Date(counters.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
