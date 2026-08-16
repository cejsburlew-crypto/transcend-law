/**
 * Command Palette Module Exports
 *
 * Export all Command Palette related components and types for easy importing.
 */

export { CommandPalette } from './CommandPalette';
export type { Command, CommandPaletteState, AnalyticsEvent } from '../hooks/useCommandPalette';

// Re-export the hook for direct use
export { useCommandPalette } from '../hooks/useCommandPalette';
