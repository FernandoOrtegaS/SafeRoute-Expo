import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';

const initialRegion = {
  latitude: -33.439078,
  longitude: -70.641158,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>SafeRoute</Text>
      </View>
      <View style={styles.mapCard}>
        <MapView style={styles.map} initialRegion={initialRegion} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F6F1',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  title: {
    color: '#193229',
    fontSize: 30,
    fontWeight: '800',
  },
  mapCard: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#DDE7DD',
  },
  map: {
    flex: 1,
  },
});
