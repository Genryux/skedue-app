import { Manrope_400Regular, Manrope_700Bold, useFonts } from '@expo-google-fonts/manrope';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Skedue</Text>
      <Text style={styles.title}>React Native + Expo scaffold ready</Text>
      <Text style={styles.body}>
        The product foundation, UI prompts, and local-first direction are already in the repo. Next up is building the
        actual app shell.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3eb',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#6a7c59',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c211b',
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 12,
  },
  body: {
    color: '#4e564b',
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
});
