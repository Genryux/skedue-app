import React from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';

type SubjectDetailScreenProps = {
  subject: any;
  onBack: () => void;
};

export default function SubjectDetailScreen({ subject, onBack }: SubjectDetailScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#1e2b26" />
        </Pressable>
        <Text style={styles.headerTitle}>{subject?.title || 'Subject Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.placeholderCard}>
          <Feather name="info" size={32} color="#2b4a3f" style={{ marginBottom: 16 }} />
          <Text style={styles.placeholderTitle}>Details coming soon</Text>
          <Text style={styles.placeholderBody}>
            Soon you'll be able to see all tasks, notes, and specific schedules for {subject?.title}.
          </Text>
        </View>
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e6e2dc',
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  placeholderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eeeae1',
  },
  placeholderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: '#1e2b26',
    marginBottom: 8,
  },
  placeholderBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#6b746f',
    textAlign: 'center',
    lineHeight: 22,
  },
});
