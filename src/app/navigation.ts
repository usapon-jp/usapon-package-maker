import type { Screen } from './app-types';

/** Back stays within the current creation flow; Home never opens a template list. */
export function previousScreen(screen: Screen, templateId: string | null): Screen | null {
  if (screen === 'home') return null;
  if (screen === 'print') return 'design';
  if (screen === 'design') return templateId === 'y2-kamasu-envelope' ? 'letter-set' : 'size';
  return 'home';
}
