export const colors = {
  domiuBlue: '#2563EB',
  domiuBlueLight: '#3B82F6',
  domiuDark: '#0F172A',
  domiuCard: '#1E293B',
  domiuInputBg: '#253244',
  domiuBorder: '#334155',
  domiuText: '#FFFFFF',
  domiuMuted: '#94A3B8',
  domiuSuccess: '#10B981',
  domiuWarning: '#F59E0B',
  domiuDanger: '#EF4444',
  domiuLight: '#F8FAFC',
} as const;

export type DomiuColor = keyof typeof colors;
