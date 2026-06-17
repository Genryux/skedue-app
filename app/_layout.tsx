import { 
  Manrope_400Regular, 
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold, 
  Manrope_800ExtraBold,
  useFonts 
} from '@expo-google-fonts/manrope';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../src/ui/theme/ThemeContext';

SplashScreen.preventAutoHideAsync();

function StackNavigator() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#0a1613' : '#f8f7f2' },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <StackNavigator />
    </ThemeProvider>
  );
}
