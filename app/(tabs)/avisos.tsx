import { StyleSheet, View, Text } from 'react-native';

export default function AvisosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Avisos</Text>
      <Text style={styles.subtitle}>No hay avisos nuevos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6F1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#193229',
  },
  subtitle: {
    fontSize: 16,
    color: '#4E6259',
    marginTop: 8,
  },
});
