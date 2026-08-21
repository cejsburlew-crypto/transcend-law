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

  // Graduation cap — FAFSA / student aid
  graduationCap: (
    <>
      <path d="M2.5 8.8 12 4.5l9.5 4.3L12 13.1z" />
      <path d="M6.5 10.6v4.6c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4.6" />
      <path d="M20.5 9.5v5" />
    </>
  ),

  // Ledger — bookkeeping
  ledger: (
    <>
      <path d="M5 3.5h13v17H5z" />
      <path d="M8.5 3.5v17" />
      <path d="M11.5 8h4M11.5 11.5h4M11.5 15h2.5" />
    </>
  ),

  // Banknote — payroll
  banknote: (
    <>
      <path d="M2.5 6.5h19v11h-19z" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),

  // Receipt — tax preparation
  receipt: (
    <>
      <path d="M6 2.8h12v18.4l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 7.5h6M9 11h6M9 14.5h3.5" />
    </>
  ),

  // Envelope with page — cover letters
  coverLetter: (
    <>
      <path d="M3 7.5h18v12H3z" />
      <path d="M3 7.5 12 14l9-6.5" />
      <path d="M8.5 3.5h7v3h-7z" />
    </>
  ),

  // Person and page — resume writing
  resume: (
    <>
      <path d="M5.5 3h13v18h-13z" />
      <circle cx="10" cy="8.5" r="2" />
      <path d="M7 13.5c0-1.6 1.3-2.5 3-2.5s3 .9 3 2.5" />
      <path d="M14.5 8h2.5M14.5 11h2.5M8 16.5h9M8 19h6" />
    </>
  ),

  // Storefront — business formation
  storefront: (
    <>
      <path d="M3 9.5 5 4.5h14l2 5" />
      <path d="M4.5 9.5v11h15v-11" />
      <path d="M3 9.5h18" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),

  // Page with star — grant writing
  grantDocument: (
    <>
      <path d="M6 3h7l4 4v14H6z" />
      <path d="M13 3v4h4" />
      <path d="m11.5 10.5 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" />
    </>
  ),

  // ---- General-purpose glyphs referenced by practice areas ----

  // Gavel — litigation / courts
  gavel: (
    <>
      <path d="M15.5 2.5l6 6-3 3-6-6z" />
      <path d="M13.5 8.5 5 17" />
      <path d="M3 20.5h9" />
    </>
  ),

  // Hammer — construction
  hammer: (
    <>
      <path d="M20.5 8.5 15 3l-4 4 5.5 5.5z" />
      <path d="M12.5 9.5 4 18v2.5h2.5L15 12" />
    </>
  ),

  // Handshake — agreements, arbitration
  handshake: (
    <>
      <path d="M3 11.5 7.5 7l4 3.5" />
      <path d="M21 11.5 16.5 7l-4 3.5" />
      <path d="M7.5 14l2.5 2.5 2-1.8 2 1.8 2.5-2.5" />
    </>
  ),

  // Heart — family, adoption
  heart: (
    <>
      <path d="M12 20.5C12 20.5 4.5 15.9 4.5 10.5A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3.1c0 5.4-7.5 10-7.5 10z" />
    </>
  ),

  // Hospital — healthcare law
  hospital: (
    <>
      <path d="M4.5 20.5V6.5h15v14" />
      <path d="M3 20.5h18" />
      <path d="M12 9.5v5M9.5 12h5" />
    </>
  ),

  // Stethoscope — medical malpractice
  stethoscope: (
    <>
      <path d="M7 3.5V9a5 5 0 0 0 10 0V3.5" />
      <path d="M4.5 3.5h4M15.5 3.5h4" />
      <path d="M12 14v2.5a3.5 3.5 0 0 0 3.5 3.5" />
      <circle cx="18.5" cy="19.5" r="2" />
    </>
  ),

  // Bandage — personal injury
  bandage: (
    <>
      <path d="M8.6 3.6 20.4 15.4a3.5 3.5 0 0 1-5 5L3.6 8.6a3.5 3.5 0 0 1 5-5z" />
      <path d="M8.6 15.4 15.4 8.6" />
      <path d="M10.5 11.2v.01M13.5 12.8v.01M12.8 10.5v.01M11.2 13.5v.01" />
    </>
  ),

  // Wheelchair — disability law
  wheelchair: (
    <>
      <circle cx="10.5" cy="17" r="4.5" />
      <circle cx="11" cy="4" r="1.8" />
      <path d="M11 6.5v5h5" />
      <path d="M16 11.5 18.5 18h2.5" />
    </>
  ),

  // Book — education, statutes
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.2 4 4.5v13c4-.3 6.5.5 8 2 1.5-1.5 4-2.3 8-2v-13c-4-.3-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),

  // Calculator — tax, estate tax
  calculator: (
    <>
      <path d="M5.5 3h13v18h-13z" />
      <path d="M8.5 6.5h7v3h-7z" />
      <path d="M9 13v.01M12 13v.01M15 13v.01M9 17v.01M12 17v.01M15 17v.01" />
    </>
  ),

  // Line chart — securities, analysis
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 16l3.5-4 3 2.5L19.5 8" />
    </>
  ),

  // Rising trend — mergers, growth
  chartUp: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 16.5l4-4 3 2.5 5-6" />
      <path d="M15.5 9h3.5v3.5" />
    </>
  ),

  // Falling trend — bankruptcy, liability
  chartDown: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 9l4 4 3-2.5 5 6" />
      <path d="M15.5 16.5h3.5V13" />
    </>
  ),

  // Leaf — environmental law
  leaf: (
    <>
      <path d="M20.5 3.5C10 3.5 4 8.5 4 15.5c0 2.2.7 4 2 5.5" />
      <path d="M6 21C6 12 12 7 20.5 3.5" />
      <path d="M20.5 3.5c.8 6.5-1.5 11-6 13-2.6 1.2-5.4.8-7.5-1" />
    </>
  ),

  // Padlock — privacy, white collar
  lock: (
    <>
      <path d="M5.5 10.5h13v10h-13z" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <circle cx="12" cy="15.2" r="1.3" />
    </>
  ),

  // Folded map — land use and zoning
  map: (
    <>
      <path d="M3 6.5 9 4.5v13l-6 2z" />
      <path d="M9 4.5l6 2v13l-6-2z" />
      <path d="M15 6.5l6-2v13l-6 2z" />
    </>
  ),

  // Passport — immigration
  passport: (
    <>
      <path d="M6 3h12v18H6z" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 16.5h6" />
    </>
  ),

  // Shield — insurance, protection
  shield: (
    <>
      <path d="M12 3l7.5 2.6v5.9c0 4.9-3.1 8.2-7.5 9.4-4.4-1.2-7.5-4.5-7.5-9.4V5.6z" />
    </>
  ),

  // Star — reputation, recognition
  star: (
    <>
      <path d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />
    </>
  ),

  // Trophy — sports law
  trophy: (
    <>
      <path d="M7.5 4.5h9V9a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H5v1.5A3 3 0 0 0 8 10.5" />
      <path d="M16.5 6H19v1.5a3 3 0 0 1-3 3" />
      <path d="M12 13.5v3.5" />
      <path d="M8.5 20.5h7" />
    </>
  ),

  // Price tag — franchise, trademark
  tag: (
    <>
      <path d="M20.5 12.5l-8 8-9-9V3.5h8z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),

  // Storefront — commercial leasing (alias of storefront)
  store: (
    <>
      <path d="M3 9.5 5 4.5h14l2 5" />
      <path d="M4.5 9.5v11h15v-11" />
      <path d="M3 9.5h18" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),

  // Warning triangle — product liability, risk
  warning: (
    <>
      <path d="M12 4 21.5 20.5H2.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5v.01" />
    </>
  ),

  // Plain page — generic document
  document: (
    <>
      <path d="M6 3h7l4 4v14H6z" />
      <path d="M13 3v4h4" />
      <path d="M9 12h6M9 15.5h4" />
    </>
  ),

  // Clipboard — filings, records
  clipboard: (
    <>
      <path d="M8.5 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 11.5h7M8.5 15h4.5" />
    </>
  ),

  // Neutral marker — fallback for unclassified areas
  circle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
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

  // User profile — account/profile page
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M3 20a9 9 0 1 0 18 0" />
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
