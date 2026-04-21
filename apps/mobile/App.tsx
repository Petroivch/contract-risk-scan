import 'react-native-gesture-handler';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiClientProvider } from './src/api/ApiClientProvider';
import { colors } from './src/theme/tokens';
import { i18n } from './src/i18n';
import { LanguageProvider, useAppLanguage } from './src/i18n/LanguageProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

const AppContent = (): JSX.Element => {
  const { isLanguageReady } = useAppLanguage();

  if (!isLanguageReady) {
    return (
      <View style={styles.loadingRoot}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingBrand}>{i18n.t('common.appName')}</Text>
          <Text style={styles.loadingText}>{i18n.t('common.loading')}</Text>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <ApiClientProvider>
      <RootNavigator />
    </ApiClientProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <SafeAreaProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingBrand: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
