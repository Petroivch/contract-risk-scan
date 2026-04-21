import 'react-native-gesture-handler';
import { Text, View } from 'react-native';
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{i18n.t('common.loading')}</Text>
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
      <SafeAreaProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

