// CSS equivalent of Expo's native gradient, only for this browser preview.
import React from 'react';
import { View, StyleSheet } from 'react-native';
export function LinearGradient({ colors, locations, start, end, style }) {
  const angle = start?.x === 0 && end?.x === 1 ? 'to right' : 'to bottom';
  const stops = colors.map((color, i) => `${color}${locations ? ` ${locations[i] * 100}%` : ''}`).join(',');
  return <View pointerEvents="none" style={[StyleSheet.flatten(style), { backgroundImage: `linear-gradient(${angle},${stops})` }]} />;
}
