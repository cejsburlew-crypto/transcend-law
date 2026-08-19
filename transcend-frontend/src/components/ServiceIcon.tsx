import React from 'react';

/**
 * Professional line-art icon set for the services directory.
 * All icons share a 24x24 viewBox and draw with `currentColor`, so the
 * surrounding card controls both size (font-size / width) and color.
 */

const ICONS: Record<string, React.ReactNode> = {
  // Scales of justice — attorneys
  scales: (
    <>
      <path d="M12 4.2v15.6" />
      <path d="M8.5 19.8h7" />
      <path d="M4 8h16" />
      <path d="M4 8 1.6 12.4M4 8l2.4 4.4" />
      <path d="M1.6 12.4a2.4 2.4 0 0 0 4.8 0" />
      <path d="M20 8l-2.4 4.4M20 8l2.4 4.4" />
      <path d="M17.6 12.4a2.4 2.4 0 0 0 4.8 0" />
    </>
  ),

  // Courthouse — directory header
  courthouse: (
    <>
      <path d="M4.5 9.5 12 4.5l7.5 5" />
      <path d="M3 9.5h18" />
      <path d="M6.5 9.5v8M10 9.5v8M14 9.5v8M17.5 9.5v8" />
      <path d="M4.5 17.5h15" />
      <path d="M3 20.5h18" />
    </>
  ),

  // Notary stamp
  stamp: (
    <>
      <path d="M10 3.5h4v3h-4z" />
      <path d="M8.5 6.5h7l1 5.5h-9z" />
      <path d="M5 12h14v3H5z" />
      <path d="M4 18.5h16" />
    </>
  ),

  // Office building — corporate law
  building: (
    <>
      <path d="M4.5 20.5V3.5h9.5v17" />
      <path d="M14 20.5v-11h5.5v11" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3" />
      <path d="M16 13h1.5M16 17h1.5" />
      <path d="M3 20.5h18" />
    </>
  ),

  // People — family law / client services
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20v-1.2c0-2.6 2.7-4.3 6-4.3s6 1.7 6 4.3V20" />
      <path d="M16.2 5.6a3.2 3.2 0 0 1 0 4.8" />
      <path d="M17.4 15c2.4.6 3.9 2 3.9 3.8V20" />
    </>
  ),

  // Lightbulb — intellectual property
  bulb: (
    <>
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
      <path d="M9.5 18.5h5" />
      <path d="M10.5 21h3" />
    </>
  ),

  // Figure slipping backward above a floor line — personal injury (slip & fall)
  falling: (
    <>
      <circle cx="7.4" cy="6.4" r="2.2" />
      <path d="M9 8.6l4.6 4.6" />
      <path d="M8.2 9.1 3.6 6.4" />
      <path d="M13.6 13.2l5.6-1.4" />
      <path d="M13.6 13.2l1.1 5" />
      <path d="M3 20.5h18" />
    </>
  ),

  // Sealed document — estate planning (wills, trusts, probate)
  sealedDocument: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 14h3.5" />
      <circle cx="14.5" cy="16.8" r="2.2" />
      <path d="M13 18.6l-.6 2 2.1-.8 2.1.8-.6-2" />
    </>
  ),

  // House — real estate
  house: (
    <>
      <path d="M3 10.8 12 4l9 6.8" />
      <path d="M5.5 9.4V20.5h13V9.4" />
      <path d="M10 20.5V15h4v5.5" />
    </>
  ),

  // Map pin — mobile / on-site service
  pin: (
    <>
      <path d="M12 21c4-4.4 6-7.6 6-10a6 6 0 1 0-12 0c0 2.4 2 5.6 6 10z" />
      <circle cx="12" cy="10.8" r="2.3" />
    </>
  ),

  // Monitor with check — electronic notarization
  monitorCheck: (
    <>
      <path d="M3 5h18v11H3z" />
      <path d="M9 9.9l2.2 2.2L15 8.3" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </>
  ),

  // Two figures joined — family mediation
  mediation: (
    <>
      <circle cx="6.5" cy="9" r="2.5" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M2.5 19.5v-1.2a4 4 0 0 1 8 0v1.2" />
      <path d="M13.5 19.5v-1.2a4 4 0 0 1 8 0v1.2" />
      <path d="M9 5.6a5.4 5.4 0 0 1 6 0" />
    </>
  ),

  // Briefcase — business mediation
  briefcase: (
    <>
      <path d="M3 8.5h18v10H3z" />
      <path d="M9 8.5V6.6A1.6 1.6 0 0 1 10.6 5h2.8A1.6 1.6 0 0 1 15 6.6v1.9" />
      <path d="M3 13h18" />
      <path d="M11 12.2h2v1.6h-2z" />
    </>
  ),

  // Separated rings — dissolution / divorce mediation
  separatedRings: (
    <>
      <circle cx="6.2" cy="12" r="4.2" />
      <circle cx="17.8" cy="12" r="4.2" />
    </>
  ),

  // Converging arrows — conflict resolution
  converge: (
    <>
      <path d="M2.5 12h6.5" />
      <path d="M6.2 8.8 9.4 12l-3.2 3.2" />
      <path d="M21.5 12H15" />
      <path d="M17.8 8.8 14.6 12l3.2 3.2" />
      <path d="M12 4.5v3M12 10.5v3M12 16.5v3" />
    </>
  ),

  // Barred window — felony bonds
  bars: (
    <>
      <path d="M3.5 4.5h17v15h-17z" />
      <path d="M8.5 4.5v15M12 4.5v15M15.5 4.5v15" />
    </>
  ),

  // Key — misdemeanor bonds / release
  key: (
    <>
      <circle cx="8.8" cy="15.2" r="3.8" />
      <path d="M11.5 12.5 19.5 4.5" />
      <path d="M16.6 7.4l2.2 2.2" />
      <path d="M18.6 5.4l2.2 2.2" />
    </>
  ),

  // Globe — immigration
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c3 2.6 3 14.4 0 17" />
      <path d="M12 3.5c-3 2.6-3 14.4 0 17" />
    </>
  ),

  // Clock — 24/7 availability
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.4 2.4" />
    </>
  ),

  // Stacked documents — legal documents / paralegals
  documents: (
    <>
      <path d="M9 2.8h6l3.5 3.5V17H9z" />
      <path d="M15 2.8v3.5h3.5" />
      <path d="M6 6.8v14.4h9.4" />
    </>
  ),

  // Microphone — court interpretation
  microphone: (
    <>
      <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M6.5 11.2a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16.8v3.7" />
      <path d="M9 20.5h6" />
    </>
  ),

  // Award seal with ribbon — certified / sworn work
  certificate: (
    <>
      <circle cx="12" cy="9.2" r="6" />
      <path d="M9.6 9.2l1.7 1.7 3.2-3.2" />
      <path d="M8.4 14.3 6.8 21.2 12 18.9l5.2 2.3-1.6-6.9" />
    </>
  ),

  // Document with signature line — notarized signing
  signedDocument: (
    <>
      <path d="M6 3h7l4 4v13.5H6z" />
      <path d="M13 3v4h4" />
      <path d="M9 11.5h5" />
      <path d="M8.6 16.4c.9-1.4 1.9-1.4 2.8 0s1.9 1.4 2.8 0" />
    </>
  ),

  // Overlapping speech bubbles — multi-language
  bubbles: (
    <>
      <path d="M2.5 4.5h11.5v7.5H8.5l-4 3v-3H2.5z" />
      <path d="M10.5 9h11v7.5h-1.5v3l-4-3h-5.5" />
    </>
  ),

  // Magnifier — legal research
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 21 21" />
      <path d="M7.5 9h6M7.5 12h4" />
    </>
  ),

  // Document with pen — document preparation
  documentPen: (
    <>
      <path d="M6 3h7l4 4v3.5" />
      <path d="M13 3v4h4" />
      <path d="M6 3v18h5.5" />
      <path d="M20.4 12.4 14 18.8l-3 .8.8-3 6.4-6.4a1.6 1.6 0 0 1 2.2 2.2z" />
    </>
  ),

  // Headset — client services
  headset: (
    <>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <path d="M4 13h2.5v5.5H4a1.5 1.5 0 0 1-1.5-1.5v-2.5A1.5 1.5 0 0 1 4 13z" />
      <path d="M20 13h-2.5v5.5H20a1.5 1.5 0 0 0 1.5-1.5v-2.5A1.5 1.5 0 0 0 20 13z" />
      <path d="M17.5 18.5v.4a2.4 2.4 0 0 1-2.4 2.4H12.5" />
    </>
  ),

  // Bar chart — dashboard
  dashboard: (
    <>
      <path d="M4.5 19V13" />
      <path d="M9.5 19V8.5" />
      <path d="M14.5 19V11.5" />
      <path d="M19.5 19V5.5" />
      <path d="M3 21h18" />
    </>
  ),

  // Speech bubble — messages
  chat: (
    <>
      <path d="M3.5 5h17v9.5h-9.5L6 18.5v-4H3.5z" />
      <path d="M7.5 8h9" />
      <path d="M7.5 11h6" />
    </>
  ),

  // Clipboard with check — compliance
  clipboardCheck: (
    <>
      <path d="M8.5 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.6 13.2l2.5 2.5 4.6-4.6" />
    </>
  ),
};

export type ServiceIconName = keyof typeof ICONS;

interface ServiceIconProps {
  name: string;
  className?: string;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({ name, className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {ICONS[name] || ICONS.scales}
  </svg>
);

export default ServiceIcon;
