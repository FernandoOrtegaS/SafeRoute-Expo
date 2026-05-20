import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Platform, SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { useEffect, useState } from 'react';

const initialRegion = {
  latitude: -33.439078,
  longitude: -70.641158,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function App() {
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const MapView =
    Platform.OS === 'web' ? null : require('react-native-maps').default;

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === Location.PermissionStatus.GRANTED;
        setHasLocationPermission(granted);

        if (!granted) {
          Alert.alert(
            'Permiso de ubicación',
            'Necesitamos acceso a tu ubicación para mostrar el mapa correctamente.',
          );
        }
      } catch (error) {
        console.warn('Error al solicitar permisos de ubicación:', error);
        setHasLocationPermission(false);
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
            <Text style={styles.webMapText}>
              Abre la app en Expo Go para ver el mapa nativo.
            </Text>
          </View>
        )}
        {hasLocationPermission === false && (
          <View style={styles.permissionWarning}>
            <Text style={styles.permissionWarningText}>
              Permiso de ubicación denegado. Activa el permiso en los ajustes para usar el mapa.
            </Text>
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
  permissionWarning: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#F8D7DA',
    borderRadius: 16,
    padding: 12,
  },
  permissionWarningText: {
    color: '#842029',
    fontSize: 14,
    textAlign: 'center',
  },
});
