import { Settings2, Tag, Tags, UserPlus, type LucideIcon } from 'lucide-react';
import { paths } from './paths';

export interface SettingsLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** The manage links in the SpendShare settings menu. */
export const SPEND_LINKS: SettingsLink[] = [
  { to: paths.categories, label: 'Categories', icon: Tag },
  { to: paths.tags, label: 'Tags', icon: Tags },
  { to: paths.groupInvites, label: 'Invite', icon: UserPlus },
  { to: paths.groupSettings, label: 'Group settings', icon: Settings2 },
];
