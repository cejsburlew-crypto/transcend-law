import React, { useState, useEffect } from 'react';
import './DynamicLeftMenu.css';

interface Tool {
  id: number;
  tool_key: string;
  tool_name: string;
  tool_order: number;
  category: string;
  is_core: boolean;
  is_free: boolean;
  can_view: boolean;
  can_create: boolean;
}

interface MenuSection {
  category: string;
  tools: Tool[];
}

interface ConferenceTool {
  id: string;
  name: string;
  icon: string;
  isConnected: boolean;
  onLaunch: () => void;
}

interface DynamicLeftMenuProps {
  personaId: number;
  personaName: string;
  personaIcon: string;
  practiceAreaId?: number;
  hireRequestId?: number;
  onSelectTool?: (tool: Tool) => void;
  onTogglePracticeArea?: () => void;
  conferenceTools?: ConferenceTool[];
}

export const DynamicLeftMenu: React.FC<DynamicLeftMenuProps> = ({
  personaId,
  personaName,
  personaIcon,
  practiceAreaId,
  hireRequestId,
  onSelectTool,
  onTogglePracticeArea,
  conferenceTools = [
    {
      id: 'zoom',
      name: 'Zoom',
      icon: '📹',
      isConnected: false,
      onLaunch: () => {},
    },
    {
      id: 'teams',
      name: 'Teams',
      icon: '💬',
      isConnected: false,
      onLaunch: () => {},
    },
    {
      id: 'meet',
      name: 'Google Meet',
      icon: '🎥',
      isConnected: false,
      onLaunch: () => {},
    },
  ],
}) => {
  const [menu, setMenu] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Core Tools']) // Core section expanded by default
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set() // Categories collapsed by default
  );
  const [menuOpen, setMenuOpen] = useState(true);
  const [activeConference, setActiveConference] = useState<string | null>(null);

  useEffect(() => {
    fetchMenu();
  }, [personaId, practiceAreaId]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const url = new URL(`/api/v2/personas/${personaId}/menu`, window.location.origin);
      if (practiceAreaId) {
        url.searchParams.append('practice_area', practiceAreaId.toString());
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.success) {
        setMenu(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionCategory: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(sectionCategory)) {
      newSet.delete(sectionCategory);
    } else {
      newSet.add(sectionCategory);
    }
    setExpandedSections(newSet);
  };

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedCategories(newSet);
  };

  if (!menuOpen) {
    return (
      <button
        className="left-menu-toggle-btn"
        onClick={() => setMenuOpen(true)}
        title="Open menu"
      >
        ☰
      </button>
    );
  }

  return (
    <aside className="left-menu">
      {/* Header */}
      <div className="left-menu-header">
        <div className="menu-header-content">
          <span className="menu-icon">{personaIcon}</span>
          <span className="menu-title">Legal Tools</span>
          <button
            className="menu-close-btn"
            onClick={() => setMenuOpen(false)}
            title="Close menu"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="left-menu-content">
        {loading ? (
          <div className="menu-loading">Loading tools...</div>
        ) : menu.length > 0 ? (
          <>
            {menu.map((section) => (
              <div key={section.category} className="menu-section">
                <button
                  className={`section-header ${section.category === 'Core Tools' ? 'core' : 'specialty'}`}
                  onClick={() => toggleSection(section.category)}
                  aria-expanded={expandedSections.has(section.category)}
                >
                  <span className="section-title">{section.category}</span>
                  <span className="section-toggle">
                    {expandedSections.has(section.category) ? '▼' : '▶'}
                  </span>
                </button>

                {expandedSections.has(section.category) && (
                  <div className="section-content">
                    {(() => {
                      // Group tools by category within section
                      const toolsByCategory = new Map<string, Tool[]>();
                      for (const tool of section.tools) {
                        if (!toolsByCategory.has(tool.category)) {
                          toolsByCategory.set(tool.category, []);
                        }
                        toolsByCategory.get(tool.category)!.push(tool);
                      }

                      return Array.from(toolsByCategory.entries()).map(([category, tools]) => (
                        <div key={category} className="tool-category">
                          <button
                            className="category-header"
                            onClick={() => toggleCategory(category)}
                            aria-expanded={expandedCategories.has(category)}
                          >
                            <span className="category-name">{category}</span>
                            <span className="category-count">{tools.length}</span>
                            <span className="category-toggle">
                              {expandedCategories.has(category) ? '▼' : '▶'}
                            </span>
                          </button>

                          {expandedCategories.has(category) && (
                            <div className="tool-list">
                              {tools.map((tool) => (
                                <button
                                  key={tool.id}
                                  className="tool-item"
                                  onClick={() => onSelectTool?.(tool)}
                                  title={tool.tool_name}
                                >
                                  <span className="tool-label">{tool.tool_name}</span>
                                  {tool.is_free && <span className="tool-badge">Free</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <div className="menu-empty">No tools available</div>
        )}

        {/* Conference Tools Section */}
        {hireRequestId && (
          <div className="conference-tools-section">
            <div className="section-header conference-header">
              <span className="section-title">📞 Conference</span>
            </div>
            <div className="conference-tools">
              {conferenceTools.map((tool) => (
                <button
                  key={tool.id}
                  className={`conference-btn ${activeConference === tool.id ? 'active' : ''} ${
                    !tool.isConnected ? 'disabled' : ''
                  }`}
                  onClick={() => {
                    if (tool.isConnected) {
                      setActiveConference(tool.id);
                      tool.onLaunch();
                    }
                  }}
                  title={
                    tool.isConnected ? `Start ${tool.name} call` : `Connect ${tool.name} account`
                  }
                  disabled={!tool.isConnected}
                >
                  <span className="conf-icon">{tool.icon}</span>
                  <span className="conf-name">{tool.name}</span>
                  {!tool.isConnected && <span className="conf-badge">Connect</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="menu-divider" />

        {/* Practice Area Info */}
        <div className="practice-area-info">
          <div className="practice-area-label">Persona: {personaName}</div>
          {practiceAreaId && (
            <button
              className="change-practice-area-btn"
              onClick={onTogglePracticeArea}
            >
              Change Practice Area
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="left-menu-footer">
        <button className="footer-btn" title="Settings">
          ⚙️ Settings
        </button>
      </div>
    </aside>
  );
};

export default DynamicLeftMenu;
