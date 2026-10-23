import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';

const styles = StyleSheet.create({ provider: { flex: 1, height: '100%' } });
export function SafeAreaProvider({ children }: React.PropsWithChildren) {
  return <View style={styles.provider}>{children}</View>;
}
export function SafeAreaView({
  edges: _edges,
  ...props
}: ViewProps & { edges?: string[] }) {
  return <View {...props} />;
}
