// TRANSCEND LAW - LIVE PLATFORM METRICS DASHBOARD
// Real-time display of network reach and strength
// Auto-updates as professionals join

import React, { useState, useEffect } from 'react';
import './PlatformMetricsDashboard.css';

const PlatformMetricsDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [networkHealth, setNetworkHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh every 30 seconds to show growth
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const metricsRes = await fetch('/api/metrics/live');
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      const healthRes = await fetch('/api/metrics/network-health');
      const healthData = await healthRes.json();
      setNetworkHealth(healthData);

      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  if (loading) {
    return <div className="metrics-loading">Loading platform metrics...</div>;
  }

  if (!metrics) {
    return <div className="metrics-error">Unable to load metrics</div>;
  }

  const professionals = metrics.by_profession || [];

  return (
    <div className="platform-metrics-dashboard">
      {/* HEADER */}
      <div className="metrics-header">
        <h1>🌐 TRANSCEND LAW NETWORK</h1>
        <p className="tagline">{metrics.message}</p>
        <p className="last-updated">
          Updated: {lastUpdated?.toLocaleTimeString()} (Auto-refreshes every 30s)
        </p>
      </div>

      {/* MAIN METRICS - BIG NUMBERS */}
      <div className="metrics-grid-main">
        <div className="metric-card large total-professionals">
          <div className="metric-number">
            {(metrics.summary.total_professionals / 1000000).toFixed(1)}M+
          </div>
          <div className="metric-label">Total Professionals</div>
          <div className="metric-detail">
            Across {metrics.summary.professions_active} professions
          </div>
        </div>

        <div className="metric-card large states-covered">
          <div className="metric-number">{metrics.summary.states_covered}</div>
          <div className="metric-label">States Covered</div>
          <div className="metric-detail">100% USA Coverage</div>
        </div>

        <div className="metric-card large network-strength">
          <div className="metric-number">
            {metrics.network_strength.status}
          </div>
          <div className="metric-label">Network Strength</div>
          <div className="metric-detail">
            {metrics.network_strength.percentage}% of target scale
          </div>
        </div>

        <div className="metric-card large referral-networks">
          <div className="metric-number">
            {(metrics.summary.referral_networks / 1000).toFixed(0)}K+
          </div>
          <div className="metric-label">Referral Paths</div>
          <div className="metric-detail">Professional connections</div>
        </div>
      </div>

      {/* PROFESSIONALS BY TYPE */}
      <div className="metrics-section">
        <h2>📊 Professionals by Type</h2>
        <div className="professions-grid">
          {professionals.map((prof, idx) => (
            <div key={idx} className="profession-card">
              <div className="profession-count">
                {prof.count > 0 ? formatNumber(prof.count) : '—'}
              </div>
              <div className="profession-name">{prof.profession_type}</div>
              {prof.count > 0 && (
                <div className="profession-bar">
                  <div
                    className="profession-bar-fill"
                    style={{
                      width: `${(prof.count / professionals[0].count) * 100}%`
                    }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* TIER BREAKDOWN */}
      <div className="metrics-section">
        <h2>🎯 Revenue Tiers</h2>
        <div className="tier-grid">
          <div className="tier-card tier-1">
            <h3>Tier 1 - High Priority</h3>
            <div className="tier-count">
              {formatNumber(metrics.tier_breakdown.tier_1_total)}
            </div>
            <div className="tier-professions">
              Paralegals, Court Reporters, Expert Witnesses, Process Servers,
              Mediators, Bail Bondsmen
            </div>
            <div className="tier-revenue">$5.5M/month potential</div>
          </div>

          <div className="tier-card tier-2">
            <h3>Tier 2 - Medium Priority</h3>
            <div className="tier-count">
              {formatNumber(metrics.tier_breakdown.tier_2_total)}
            </div>
            <div className="tier-professions">
              Title Agents, Legal Consultants, Document Preparers, Forensic
              Accountants
            </div>
            <div className="tier-revenue">$2.35M/month potential</div>
          </div>

          <div className="tier-card tier-3">
            <h3>Tier 3 - Growth</h3>
            <div className="tier-count">
              {formatNumber(metrics.tier_breakdown.tier_3_total)}
            </div>
            <div className="tier-professions">
              Background Checks, Skip Tracers, Insurance Adjusters, and more
            </div>
            <div className="tier-revenue">$3.35M/month potential</div>
          </div>
        </div>
      </div>

      {/* NETWORK HEALTH */}
      {networkHealth && (
        <div className="metrics-section network-health">
          <h2>🔗 Network Health</h2>
          <div className="health-grid">
            <div className="health-card">
              <div className="health-label">Referral Connections</div>
              <div className="health-value">
                {formatNumber(networkHealth.network.total_referral_connections)}
              </div>
            </div>
            <div className="health-card">
              <div className="health-label">Monthly Volume Potential</div>
              <div className="health-value">
                {networkHealth.network.estimated_monthly_volume}
              </div>
            </div>
            <div className="health-card">
              <div className="health-label">Matching Rules Active</div>
              <div className="health-value">
                {networkHealth.matching_engine.active_matching_rules}
              </div>
            </div>
            <div className="health-card">
              <div className="health-label">Network Status</div>
              <div className="health-value health-status-good">
                {networkHealth.health_status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALL TO ACTION */}
      <div className="metrics-cta">
        <h2>Join the Network</h2>
        <p>
          Be part of TRANSCEND LAW's growing network of legal professionals.
          Connect with clients and referral sources.
        </p>
        <button className="cta-button">Sign Up as Professional</button>
      </div>

      {/* FOOTER */}
      <div className="metrics-footer">
        <p>
          📈 Real-time metrics • 🌍 All 50 states + DC • 💼 20 profession types
          • 🚀 Growing daily
        </p>
      </div>
    </div>
  );
};

// HELPER FUNCTIONS
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}

export default PlatformMetricsDashboard;
