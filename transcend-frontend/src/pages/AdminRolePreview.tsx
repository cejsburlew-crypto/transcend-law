/**
 * Admin Role Preview
 * View all menus and items from different user perspectives
 * Helps verify UI consistency across roles
 */

import React, { useState } from 'react';
import './AdminRolePreview.css';

type UserRole = 'client' | 'admin' | 'service_provider';

interface RoleMenuItem {
  label: string;
  path: string;
  icon?: string;
  submenu?: RoleMenuItem[];
}

interface RoleMenuStructure {
  [key in UserRole]: {
    name: string;
    description: string;
    menus: RoleMenuItem[];
    sections: {
      label: string;
      items: string[];
    }[];
  };
}

const ROLE_MENUS: RoleMenuStructure = {
  client: {
    name: 'Client',
    description: 'View as a legal services client using the platform',
    menus: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: '📊',
        submenu: [
          { label: 'My Services', path: '/dashboard/services' },
          { label: 'Active Cases', path: '/dashboard/cases' },
          { label: 'Documents', path: '/dashboard/documents' },
          { label: 'Payments', path: '/dashboard/payments' },
        ],
      },
      {
        label: 'Find Services',
        path: '/services',
        icon: '🔍',
        submenu: [
          { label: 'All Services', path: '/services/directory' },
          { label: 'Browse by Type', path: '/services/categories' },
          { label: 'Search', path: '/services/search' },
          { label: 'Saved', path: '/services/saved' },
        ],
      },
      {
        label: 'Find Lawyers',
        path: '/lawyers',
        icon: '⚖️',
        submenu: [
          { label: 'Browse Attorneys', path: '/lawyers/directory' },
          { label: 'Specializations', path: '/lawyers/specializations' },
          { label: 'Nearby Lawyers', path: '/lawyers/proximity' },
          { label: 'Recommendations', path: '/lawyers/recommended' },
        ],
      },
      {
        label: 'My Profile',
        path: '/profile',
        icon: '👤',
        submenu: [
          { label: 'Edit Profile', path: '/profile/edit' },
          { label: 'Preferences', path: '/profile/preferences' },
          { label: 'Privacy Settings', path: '/profile/privacy' },
        ],
      },
      {
        label: 'Support',
        path: '/support',
        icon: '❓',
        submenu: [
          { label: 'Help Center', path: '/support/help' },
          { label: 'Contact Us', path: '/support/contact' },
          { label: 'FAQ', path: '/support/faq' },
        ],
      },
    ],
    sections: [
      {
        label: 'Quick Actions',
        items: ['Request Service', 'Schedule Consultation', 'Upload Documents', 'Pay Invoice'],
      },
      {
        label: 'Recent Activity',
        items: ['View recent cases', 'Check payment status', 'Review messages', 'See notifications'],
      },
      {
        label: 'Account',
        items: ['View profile', 'Change password', 'Manage email', 'Two-factor auth'],
      },
    ],
  },
  admin: {
    name: 'Transcend Law Admin',
    description: 'View as a Transcend Law administrator managing the platform',
    menus: [
      {
        label: 'Dashboard',
        path: '/admin',
        icon: '📊',
        submenu: [
          { label: 'Overview', path: '/admin/overview' },
          { label: 'Analytics', path: '/admin/analytics' },
          { label: 'Metrics', path: '/admin/metrics' },
          { label: 'Reports', path: '/admin/reports' },
        ],
      },
      {
        label: 'Users',
        path: '/admin/users',
        icon: '👥',
        submenu: [
          { label: 'All Users', path: '/admin/users/list' },
          { label: 'Clients', path: '/admin/users/clients' },
          { label: 'Service Providers', path: '/admin/users/providers' },
          { label: 'Attorneys', path: '/admin/users/attorneys' },
          { label: 'Verifications', path: '/admin/users/verifications' },
        ],
      },
      {
        label: 'Services',
        path: '/admin/services',
        icon: '⚙️',
        submenu: [
          { label: 'Manage Services', path: '/admin/services/manage' },
          { label: 'Categories', path: '/admin/services/categories' },
          { label: 'Pricing', path: '/admin/services/pricing' },
          { label: 'Availability', path: '/admin/services/availability' },
        ],
      },
      {
        label: 'Deployments',
        path: '/admin/deployments',
        icon: '🚀',
        submenu: [
          { label: 'Feature Deployments', path: '/admin/deployments/features' },
          { label: 'Bug Fixes', path: '/admin/deployments/bugs' },
          { label: 'Status', path: '/admin/deployments/status' },
          { label: 'Rollback', path: '/admin/deployments/rollback' },
        ],
      },
      {
        label: 'Bug & Fix Panel',
        path: '/admin/bug-fix',
        icon: '🐛',
        submenu: [
          { label: 'Report Issue', path: '/admin/bug-fix/report' },
          { label: 'Fix Requests', path: '/admin/bug-fix/requests' },
          { label: 'In Progress', path: '/admin/bug-fix/in-progress' },
          { label: 'Completed', path: '/admin/bug-fix/completed' },
        ],
      },
      {
        label: 'Payments',
        path: '/admin/payments',
        icon: '💳',
        submenu: [
          { label: 'Transactions', path: '/admin/payments/transactions' },
          { label: 'Disputes', path: '/admin/payments/disputes' },
          { label: 'Refunds', path: '/admin/payments/refunds' },
          { label: 'Billing', path: '/admin/payments/billing' },
        ],
      },
      {
        label: 'Settings',
        path: '/admin/settings',
        icon: '⚙️',
        submenu: [
          { label: 'General', path: '/admin/settings/general' },
          { label: 'Security', path: '/admin/settings/security' },
          { label: 'Integrations', path: '/admin/settings/integrations' },
          { label: 'Compliance', path: '/admin/settings/compliance' },
        ],
      },
    ],
    sections: [
      {
        label: 'Platform Stats',
        items: ['Active users', 'Services offered', 'Revenue', 'Transactions', 'Disputes'],
      },
      {
        label: 'Monitoring',
        items: ['System health', 'Error logs', 'Performance', 'Uptime', 'Alerts'],
      },
      {
        label: 'Quick Actions',
        items: ['Verify user', 'Approve service', 'Resolve dispute', 'Send announcement'],
      },
    ],
  },
  service_provider: {
    name: 'Service Provider',
    description: 'View as a service provider offering services on the platform',
    menus: [
      {
        label: 'Dashboard',
        path: '/provider/dashboard',
        icon: '📊',
        submenu: [
          { label: 'Overview', path: '/provider/dashboard/overview' },
          { label: 'Earnings', path: '/provider/dashboard/earnings' },
          { label: 'Performance', path: '/provider/dashboard/performance' },
          { label: 'Reviews', path: '/provider/dashboard/reviews' },
        ],
      },
      {
        label: 'Services',
        path: '/provider/services',
        icon: '📋',
        submenu: [
          { label: 'My Services', path: '/provider/services/list' },
          { label: 'Create Service', path: '/provider/services/create' },
          { label: 'Pricing', path: '/provider/services/pricing' },
          { label: 'Availability', path: '/provider/services/availability' },
        ],
      },
      {
        label: 'Clients',
        path: '/provider/clients',
        icon: '👥',
        submenu: [
          { label: 'Active Clients', path: '/provider/clients/active' },
          { label: 'Messages', path: '/provider/clients/messages' },
          { label: 'Requests', path: '/provider/clients/requests' },
          { label: 'Reviews', path: '/provider/clients/reviews' },
        ],
      },
      {
        label: 'Website Hosting',
        path: '/provider/website',
        icon: '🌐',
        submenu: [
          { label: 'My Website', path: '/provider/website/my-website' },
          { label: 'Setup', path: '/provider/website/setup' },
          { label: 'Analytics', path: '/provider/website/analytics' },
          { label: 'Settings', path: '/provider/website/settings' },
        ],
      },
      {
        label: 'Payments',
        path: '/provider/payments',
        icon: '💰',
        submenu: [
          { label: 'Earnings', path: '/provider/payments/earnings' },
          { label: 'Payouts', path: '/provider/payments/payouts' },
          { label: 'Invoices', path: '/provider/payments/invoices' },
          { label: 'Tax', path: '/provider/payments/tax' },
        ],
      },
      {
        label: 'Profile',
        path: '/provider/profile',
        icon: '👤',
        submenu: [
          { label: 'Edit Profile', path: '/provider/profile/edit' },
          { label: 'Credentials', path: '/provider/profile/credentials' },
          { label: 'Verification', path: '/provider/profile/verification' },
          { label: 'Settings', path: '/provider/profile/settings' },
        ],
      },
    ],
    sections: [
      {
        label: 'Performance Metrics',
        items: ['Total earnings', 'Active clients', 'Completion rate', 'Rating', 'Response time'],
      },
      {
        label: 'Recent Activity',
        items: ['New requests', 'Messages', 'Completed services', 'Reviews received'],
      },
      {
        label: 'Quick Actions',
        items: ['Accept request', 'Message client', 'Update availability', 'Create invoice'],
      },
    ],
  },
};

export const AdminRolePreview: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('client');
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  const roleData = ROLE_MENUS[selectedRole];

  const toggleMenu = (label: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedMenus(newExpanded);
  };

  const expandAll = () => {
    const all = new Set(roleData.menus.map((m) => m.label));
    setExpandedMenus(all);
  };

  const collapseAll = () => {
    setExpandedMenus(new Set());
  };

  return (
    <div className="admin-role-preview">
      <div className="preview-header">
        <h1>📱 Role Preview Dashboard</h1>
        <p>View all menus and items from different user perspectives</p>
      </div>

      <div className="role-selector-container">
        <div className="role-buttons">
          {(Object.keys(ROLE_MENUS) as UserRole[]).map((role) => (
            <button
              key={role}
              className={`role-button ${selectedRole === role ? 'active' : ''}`}
              onClick={() => {
                setSelectedRole(role);
                setExpandedMenus(new Set());
              }}
            >
              {ROLE_MENUS[role].name}
            </button>
          ))}
        </div>
      </div>

      <div className="role-preview-container">
        <div className="preview-info">
          <h2>{roleData.name}</h2>
          <p>{roleData.description}</p>
        </div>

        <div className="controls">
          <button className="control-btn" onClick={expandAll}>
            Expand All
          </button>
          <button className="control-btn" onClick={collapseAll}>
            Collapse All
          </button>
        </div>

        <div className="menus-scroll">
          <div className="menus-container">
            <h3 className="menus-title">📋 Navigation Menu</h3>

            <div className="menu-items">
              {roleData.menus.map((menu) => (
                <div key={menu.label} className="menu-item">
                  <button
                    className={`menu-header ${expandedMenus.has(menu.label) ? 'expanded' : ''}`}
                    onClick={() => toggleMenu(menu.label)}
                  >
                    <span className="menu-icon">{menu.icon || '📄'}</span>
                    <span className="menu-label">{menu.label}</span>
                    <span className="menu-arrow">{expandedMenus.has(menu.label) ? '▼' : '▶'}</span>
                  </button>

                  {expandedMenus.has(menu.label) && menu.submenu && (
                    <div className="submenu">
                      {menu.submenu.map((sub) => (
                        <div key={sub.path} className="submenu-item">
                          <span className="submenu-icon">→</span>
                          <span className="submenu-label">{sub.label}</span>
                          <code className="submenu-path">{sub.path}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="sections-container">
            <h3 className="sections-title">⚡ Quick Access Sections</h3>

            <div className="sections">
              {roleData.sections.map((section) => (
                <div key={section.label} className="section">
                  <h4 className="section-label">{section.label}</h4>
                  <ul className="section-items">
                    {section.items.map((item) => (
                      <li key={item} className="section-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="verification-checklist">
        <h3>✅ Verification Checklist</h3>
        <div className="checklist-items">
          <label className="checklist-item">
            <input type="checkbox" />
            <span>All menu items are visible and properly labeled</span>
          </label>
          <label className="checklist-item">
            <input type="checkbox" />
            <span>Navigation paths are correct and accessible</span>
          </label>
          <label className="checklist-item">
            <input type="checkbox" />
            <span>Icons are displaying correctly</span>
          </label>
          <label className="checklist-item">
            <input type="checkbox" />
            <span>Submenu items load without errors</span>
          </label>
          <label className="checklist-item">
            <input type="checkbox" />
            <span>Quick access sections match role permissions</span>
          </label>
          <label className="checklist-item">
            <input type="checkbox" />
            <span>Layout is responsive on mobile devices</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default AdminRolePreview;
