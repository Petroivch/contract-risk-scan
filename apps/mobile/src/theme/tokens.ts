import { designTokenConfig } from '../config/designTokens';

export const theme = {
  colors: designTokenConfig.color,
  spacing: designTokenConfig.spacing,
  radius: designTokenConfig.radius,
  typography: designTokenConfig.typography,
  shadow: designTokenConfig.shadow,
  motion: designTokenConfig.motion,
} as const;

export const colors = theme.colors;
export const spacing = theme.spacing;
export const radius = theme.radius;
export const typography = theme.typography;
export const shadow = theme.shadow;
export const motion = theme.motion;
