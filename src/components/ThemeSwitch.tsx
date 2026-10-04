import SegmentedControl from './ui/SegmentedControl';
import { useUIStore } from '../stores/uiStore';
import { THEME_OPTIONS } from '../lib/theme';

export default function ThemeSwitch({ className }: { className?: string }) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  return (
    <SegmentedControl
      label="Appearance"
      options={THEME_OPTIONS}
      value={theme}
      onChange={setTheme}
      size="sm"
      className={className}
    />
  );
}
