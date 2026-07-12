/**
 * Majestic Flavors design tokens.
 *
 * These mirror the values defined in `global.css` (@theme). NativeWind
 * classes are the default styling approach — only reach for these tokens
 * in the StyleSheet exception cases called out in AGENTS.md (SafeAreaView,
 * Modal, shadows, dynamic/platform-specific styles, etc.).
 */

export const colors = {
  gold: "#C8A44A",
  maroon: "#7B1515",
  darkGreen: "#1B3A2D",
  cream: "#F8EDD5",
  white: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6B",
  border: "#E8E0D0",
  inStock: "#16a34a",
  lowStock: "#d97706",
  outOfStock: "#dc2626",
} as const;

export const fonts = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semiBold: "Inter-SemiBold",
  bold: "Inter-Bold",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;
