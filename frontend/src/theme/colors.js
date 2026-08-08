// Palette of selectable church themes; each entry provides the full shade set for
// light and dark variants (seed/dark/medium/highlight/light/bg).
export const ALL_COLORS = [
  { name: 'Blue', seed: '#2196f3', dark: '#1565c0', medium: '#1e88e5', highlight: '#42a5f5', light: '#90caf9', bg: '#e3f2fd' },
  { name: 'Indigo', seed: '#3f51b5', dark: '#1a237e', medium: '#303f9f', highlight: '#5c6bc0', light: '#9fa8da', bg: '#e8eaf6' },
  { name: 'Teal', seed: '#009688', dark: '#00695c', medium: '#00796b', highlight: '#26a69a', light: '#80cbc4', bg: '#e0f2f1' },
  { name: 'Green', seed: '#4caf50', dark: '#2e7d32', medium: '#43a047', highlight: '#66bb6a', light: '#a5d6a7', bg: '#e8f5e9' },
  { name: 'Purple', seed: '#9c27b0', dark: '#6a1b9a', medium: '#8e24aa', highlight: '#ab47bc', light: '#ce93d8', bg: '#f3e5f5' },
  { name: 'Red', seed: '#f44336', dark: '#c62828', medium: '#e53935', highlight: '#ef5350', light: '#ef9a9a', bg: '#ffebee' },
  { name: 'Orange', seed: '#ff9800', dark: '#e65100', medium: '#fb8c00', highlight: '#ffa726', light: '#ffcc80', bg: '#fff3e0' },
  { name: 'Cyan', seed: '#00bcd4', dark: '#00838f', medium: '#00acc1', highlight: '#26c6da', light: '#80deea', bg: '#e0f7fa' },
  { name: 'Deep Purple', seed: '#673ab7', dark: '#4527a0', medium: '#5e35b1', highlight: '#7e57c2', light: '#b39ddb', bg: '#ede7f6' },
  { name: 'Pink', seed: '#e91e63', dark: '#ad1457', medium: '#d81b60', highlight: '#ec407a', light: '#f48fb1', bg: '#fce4ec' },
  { name: 'Amber', seed: '#ffc107', dark: '#ff8f00', medium: '#ffb300', highlight: '#ffca28', light: '#ffe082', bg: '#fff8e1' },
  { name: 'Lime', seed: '#cddc39', dark: '#9e9d24', medium: '#c0ca33', highlight: '#d4e157', light: '#e6ee9c', bg: '#f9fbe7' },
  { name: 'Light Blue', seed: '#03a9f4', dark: '#0277bd', medium: '#039be5', highlight: '#29b6f6', light: '#81d4fa', bg: '#e1f5fe' },
  { name: 'Deep Orange', seed: '#ff5722', dark: '#bf360c', medium: '#f4511e', highlight: '#ff7043', light: '#ffab91', bg: '#fbe9e7' },
  { name: 'Brown', seed: '#795548', dark: '#4e342e', medium: '#6d4c41', highlight: '#8d6e63', light: '#bcaaa4', bg: '#efebe9' },
  { name: 'Blue Grey', seed: '#607d8b', dark: '#37474f', medium: '#546e7a', highlight: '#78909c', light: '#b0bec5', bg: '#eceff1' },
];

export const DEFAULT_COLOR = 'Blue';

// Look up a theme by name, falling back to the first entry for unknown names.
export function getColorInfo(name) {
  return ALL_COLORS.find((c) => c.name === name) || ALL_COLORS[0];
}

// Applies the active theme to the DOM: writes each shade to CSS variables on <html>
// and flags the theme name + dark mode so the stylesheet can react.
export function applyThemeVars(name, dark) {
  const c = getColorInfo(name);
  const root = document.documentElement;
  root.style.setProperty('--theme-seed', c.seed);
  root.style.setProperty('--theme-dark', c.dark);
  root.style.setProperty('--theme-medium', c.medium);
  root.style.setProperty('--theme-highlight', c.highlight);
  root.style.setProperty('--theme-light', c.light);
  root.style.setProperty('--theme-bg', c.bg);
  root.dataset.themeName = c.name;
  root.dataset.dark = dark ? 'true' : 'false';
}
