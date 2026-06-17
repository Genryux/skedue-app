import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/theme/ThemeContext';
import { shadowLg } from '../../ui/tokens/shadows';
import { exportBackup, importBackup } from '../../services/backupRestore';
import { clearAllData } from '../../data/local/db';

const SETTINGS_SECTIONS = [
  {
    title: 'Appearance',
    items: [
      { icon: 'moon' as const, label: 'Dark Mode', type: 'toggle' as const },
    ],
  },
  {
    title: 'Data',
    items: [
      { icon: 'upload' as const, label: 'Backup Data', type: 'action' as const },
      { icon: 'download' as const, label: 'Restore Data', type: 'action' as const },
    ],
  },
  {
    title: 'About',
    items: [
      { icon: 'info' as const, label: 'Version', type: 'info' as const, value: '1.0.0' },
    ],
  },
  {
    title: 'Danger Zone',
    danger: true,
    items: [
      { icon: 'trash-2' as const, label: 'Clear All Data', type: 'danger' as const },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleBackup = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage('Preparing backup...');
    try {
      await exportBackup();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Backup failed';
      Alert.alert('Backup Failed', msg);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  const handleRestore = useCallback(async () => {
    Alert.alert(
      'Restore Data',
      'This will replace all your current data with the backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            setLoadingMessage('Restoring data...');
            try {
              const result = await importBackup();
              if (result.success) {
                router.back();
              } else if (result.message !== 'Import cancelled') {
                Alert.alert('Restore Failed', result.message);
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Restore failed';
              Alert.alert('Restore Failed', msg);
            } finally {
              setIsLoading(false);
              setLoadingMessage('');
            }
          },
        },
      ]
    );
  }, [router]);

  const handleClearData = useCallback(async () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your subjects, notes, tasks, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            setLoadingMessage('Clearing data...');
            try {
              await clearAllData();
              router.back();
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Failed to clear data';
              Alert.alert('Error', msg);
            } finally {
              setIsLoading(false);
              setLoadingMessage('');
            }
          },
        },
      ]
    );
  }, [router]);

  const handleAction = useCallback((label: string) => {
    if (label === 'Backup Data') {
      handleBackup();
    } else if (label === 'Restore Data') {
      handleRestore();
    } else if (label === 'Clear All Data') {
      handleClearData();
    }
  }, [handleBackup, handleRestore, handleClearData]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark, { paddingTop: insets.top + 8 }]}>
        <Pressable style={[styles.backButton, isDark && styles.backButtonDark]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={isDark ? '#d7e4dd' : '#1e2b26'} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {SETTINGS_SECTIONS.map((section, sIdx) => (
          <View key={section.title} style={{ marginBottom: sIdx < SETTINGS_SECTIONS.length - 1 ? 24 : 0 }}>
            <Text style={[styles.sectionTitle, section.danger && styles.sectionTitleDanger, isDark && styles.sectionTitleDark]}>{section.title}</Text>
            <View style={[styles.card, section.danger && styles.cardDanger, isDark && styles.cardDark]}>
              {section.items.map((item, iIdx) => (
                <View key={item.label}>
                  {iIdx > 0 && <View style={[styles.separator, isDark && styles.separatorDark]} />}
                  {item.type === 'toggle' ? (
                    <View style={styles.row}>
                      <Feather name={item.icon} size={16} color={isDark ? '#8f9b95' : '#5c6762'} style={{ marginRight: 10 }} />
                      <Text style={[styles.rowLabel, isDark && styles.rowLabelDark]}>{item.label}</Text>
                      <View style={{ flex: 1 }} />
                      <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: '#e3e0d8', true: '#3d6657' }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  ) : item.type === 'danger' ? (
                    <Pressable style={styles.row} onPress={() => handleAction(item.label)}>
                      <Feather name={item.icon} size={16} color="#d1453b" style={{ marginRight: 10 }} />
                      <Text style={[styles.rowLabel, styles.rowLabelDanger]}>{item.label}</Text>
                      <View style={{ flex: 1 }} />
                      <Feather name="chevron-right" size={18} color="#d1453b" />
                    </Pressable>
                  ) : item.type === 'action' ? (
                    <Pressable style={styles.row} onPress={() => handleAction(item.label)}>
                      <Feather name={item.icon} size={16} color={isDark ? '#8f9b95' : '#5c6762'} style={{ marginRight: 10 }} />
                      <Text style={[styles.rowLabel, isDark && styles.rowLabelDark]}>{item.label}</Text>
                      <View style={{ flex: 1 }} />
                      <Feather name="chevron-right" size={18} color={isDark ? '#6e7b74' : '#9aa09a'} />
                    </Pressable>
                  ) : (
                    <View style={styles.row}>
                      <Feather name={item.icon} size={16} color={isDark ? '#8f9b95' : '#5c6762'} style={{ marginRight: 10 }} />
                      <Text style={[styles.rowLabel, isDark && styles.rowLabelDark]}>{item.label}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={[styles.rowValue, isDark && styles.rowValueDark]}>{item.value}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={isLoading} transparent animationType="fade">
        <View style={[styles.overlay, isDark && styles.overlayDark]}>
          <View style={[styles.loadingCard, isDark && styles.loadingCardDark]}>
            <ActivityIndicator size="large" color={isDark ? '#3d6657' : '#16312b'} />
            <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>{loadingMessage}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#f8f7f2',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fcfbfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f2f1ee',
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#6b746f',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadowLg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  rowLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
  },
  rowValue: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#8f968f',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0ed',
    marginLeft: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayDark: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  loadingCardDark: {
    backgroundColor: '#0f201b',
  },
  loadingText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: '#1e2b26',
  },
  loadingTextDark: {
    color: '#d7e4dd',
  },
  containerDark: {
    backgroundColor: '#0a1613',
  },
  headerDark: {
    backgroundColor: '#0a1613',
  },
  backButtonDark: {
    backgroundColor: '#0f201b',
    borderColor: '#2a3d36',
  },
  headerTitleDark: {
    color: '#d7e4dd',
  },
  sectionTitleDark: {
    color: '#8f9b95',
  },
  sectionTitleDanger: {
    color: '#d1453b',
  },
  cardDanger: {
    borderWidth: 1,
    borderColor: '#d1453b',
  },
  rowLabelDanger: {
    color: '#d1453b',
  },
  cardDark: {
    backgroundColor: '#0f201b',
  },
  rowLabelDark: {
    color: '#d7e4dd',
  },
  rowValueDark: {
    color: '#7a8a82',
  },
  separatorDark: {
    backgroundColor: '#2a3d36',
  },
});
