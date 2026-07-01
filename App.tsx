import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';

const initialRegion = {
  latitude: -33.439078,
  longitude: -70.641158,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function App() {
  const MapView = Platform.OS === 'web' ? null : require('react-native-maps').default;

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch (error) {
        console.warn('Error al solicitar permisos de ubicacion:', error);
      }
    };

    requestLocationPermission();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>SafeRoute</Text>
      </View>
      <View style={styles.mapCard}>
        {MapView ? (
          <MapView style={styles.map} initialRegion={initialRegion} />
        ) : (
          <View style={styles.webMapFallback}>
            <Text style={styles.webMapTitle}>Mapa no disponible en web</Text>
            <Text style={styles.webMapText}>Abre la app en Expo Go para ver el mapa nativo.</Text>
          </View>
        )}
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
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webMapTitle: {
    color: '#193229',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  webMapText: {
    color: '#4E6259',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});
