/**
 * Non-CSS consumers (canvas and generated fallbacks) use this finite neutral
 * palette. Each tuple intentionally has equal channels.
 */
export const MONOCHROME_RGB = {
  black: [0, 0, 0],
  ink: [26, 26, 26],
  graphite: [51, 51, 51],
  slate: [107, 107, 107],
  silver: [194, 194, 194],
  white: [255, 255, 255],
} as const;

export type MonochromeToken = keyof typeof MONOCHROME_RGB;
