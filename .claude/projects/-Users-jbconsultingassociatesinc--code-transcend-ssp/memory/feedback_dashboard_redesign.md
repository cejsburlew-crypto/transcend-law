---
name: dashboard_redesign_feedback
description: Dashboard must have clean, readable layout with proper contrast and no scattered elements
metadata:
  type: feedback
---

**Dashboard Redesign Requirements:**

1. **Text Readability**: All text must be readable with proper contrast
   - **Why:** Previous dashboard had poor contrast (bright green text, dark on dark text making it unreadable)
   - **How to apply:** Use dark text on light/white backgrounds, avoid dark backgrounds for text content

2. **No Scattered Layout**: Dashboard layout should be organized, not cluttered with scattered small elements
   - **Why:** Previous version had many small metric cards, action cards, and sections scattered across the page making it feel chaotic
   - **How to apply:** Group related content in clear sections, use consistent spacing and alignment, remove redundant UI elements

3. **Clean Card Design**: Case cards and other content should use clean white cards with clear information hierarchy
   - **Why:** Dark case cards with progress bars had poor readability and visual hierarchy
   - **How to apply:** Use white/light background cards, clear provider info sections, readable status badges

4. **Remove Redundant Navigation**: Services menu should not appear as both a header menu AND as accessible via CTA buttons
   - **Why:** Users found "Services menu is redundant"
   - **How to apply:** Access Services from Dashboard CTA buttons or breadcrumb only, remove Services dropdown from navigation

5. **Verify Live Deployment**: Changes must appear on actual deployed site, not just dev server
   - **Why:** User sees old design with dark cards and poor contrast on their view
   - **How to apply:** Ensure git changes are pushed and deployed to live environment
