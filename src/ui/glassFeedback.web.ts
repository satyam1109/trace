import type { ViewStyle } from 'react-native';
// Web-only backdrop filtering; native never receives unsupported CSS properties.
export const glassOverlayStyle = {
  backdropFilter: 'blur(10px) saturate(125%)',
  WebkitBackdropFilter: 'blur(10px) saturate(125%)',
} as ViewStyle;
