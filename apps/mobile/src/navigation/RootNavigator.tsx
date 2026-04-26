import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AnalysisStatusScreen } from '../screens/AnalysisStatusScreen';
import { ReportItemDetailScreen } from '../screens/ReportItemDetailScreen';
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
        initialRouteName="UploadWithRole"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="UploadWithRole" component={UploadWithRoleScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="AnalysisStatus" component={AnalysisStatusScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="ReportItemDetail" component={ReportItemDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
