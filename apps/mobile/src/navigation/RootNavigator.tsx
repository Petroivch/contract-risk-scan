import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AnalysisStatusScreen } from '../screens/AnalysisStatusScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { UploadWithRoleScreen } from '../screens/UploadWithRoleScreen';
import { colors } from '../theme/tokens';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = (): JSX.Element => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Auth"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="UploadWithRole" component={UploadWithRoleScreen} />
        <Stack.Screen name="AnalysisStatus" component={AnalysisStatusScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
