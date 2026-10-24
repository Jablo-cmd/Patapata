import { useColorScheme } from 'react-native';

import { darkColors, lightColors, layout, radii, spacing, typography, type ColorTokens } from './tokens';

export * from './tokens';

export type Theme = {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  layout: typeof layout;
};

const light: Theme = { dark: false, colors: lightColors, spacing, radii, typography, layout };
const dark: Theme = { dark: true, colors: darkColors, spacing, radii, typography, layout };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
