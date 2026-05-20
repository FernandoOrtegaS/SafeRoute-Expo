import { Alert, StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import React, { useEffect, useState } from 'react';
import MapView, { Circle, Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [originInput, setOriginInput] = useState('Elegir ubicación actual');
  const [destinationInput, setDestinationInput] = useState('');
  const [showInputs, setShowInputs] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<string | { latitude: number; longitude: number }>('Elegir ubicación actual');
  const [routeDestination, setRouteDestination] = useState<string>('');

  const origin = {latitude: -33.440058, longitude: -70.640881};
  const destination = {latitude: -33.436872, longitude: -70.638914};
  const GOOGLE_MAPS_APIKEY = 'AIzaSyBdLccbhV2MPNVXgs4PEISQCmE8LY9A7e0';

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
        } else {
          Alert.alert(
            'Permiso de ubicación',
            'Necesitamos acceso a tu ubicación para mostrar dónde estás en el mapa.',
          );
        }
      } catch (error) {
        console.warn('Error al solicitar permisos de ubicación:', error);
      }
    };

    requestLocationPermission();
  }, []);

  const handleUseCurrentLocation = () => {
    if (userLocation) {
      setOriginInput('Ubicación actual');
      setRouteOrigin(userLocation);
    } else {
      Alert.alert('Ubicación', 'Ubicación actual no disponible');
    }
  };

  const handleGenerateRoute = () => {
    if (!destinationInput.trim()) {
      Alert.alert('Destino', 'Ingresa un destino para generar la ruta');
      return;
    }

    if (originInput === 'Elegir ubicación actual' && userLocation) {
      setRouteOrigin(userLocation);
    } else if (originInput !== 'Elegir ubicación actual') {
      setRouteOrigin(originInput);
    }

    setRouteDestination(destinationInput);
    setShowInputs(false);
  };

  const lats = [];
  const lngs = [];

  const currentRouteOrigin =
    typeof routeOrigin === 'string' && routeOrigin === 'Elegir ubicación actual'
      ? origin
      : routeOrigin;
  const currentRouteDestination = routeDestination || destination;

  return (
    <View style={styles.container}>
      <MapView style={styles.map}
        provider="google"
        region={{
          latitude: -33.438367,
          longitude: -70.640500,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        showsUserLocation={true}
        zoomEnabled={true}
        rotateEnabled={false}
        scrollEnabled={true}
        pitchEnabled={false}
      >
        <Circle
          center={destination}
          radius={10}
          strokeColor='blue'
          fillColor='blue'
        />
        <Circle
          center={origin}
          radius={10}
          strokeColor='blue'
          fillColor='blue'
        />
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Tu ubicación"
            pinColor="green"
          />
        )}
        <Marker
          coordinate={destination}
        />
        <MapViewDirections
          origin={currentRouteOrigin}
          destination={currentRouteDestination}
          apikey={GOOGLE_MAPS_APIKEY}
          mode='WALKING'
          strokeWidth={10}
        />
      </MapView>

      {/* Header y Inputs */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.headerButton} onPress={() => setShowInputs((prev) => !prev)}>
          <Text style={styles.headerTitle}>{showInputs ? 'Cerrar destino' : 'Elegir destino'}</Text>
          <Ionicons name={showInputs ? 'chevron-up' : 'chevron-down'} size={20} color="#1E5A96" />
        </TouchableOpacity>
      </View>

      {showInputs && (
        <View style={styles.floatingInputsContainer}>
          {/* Inputs Container */}
          <View style={styles.inputsContainer}>
          {/* Origin Input */}
          <View style={styles.inputRow}>
            <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Elegir ubicación actual"
              value={originInput}
              onChangeText={setOriginInput}
              placeholderTextColor="#999"
            />
            <TouchableOpacity onPress={handleUseCurrentLocation}>
              <Ionicons name="sync" size={20} color="#1E5A96" />
            </TouchableOpacity>
          </View>

          {/* Destination Input */}
          <View style={styles.inputRow}>
            <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Buscar destino..."
              value={destinationInput}
              onChangeText={setDestinationInput}
              placeholderTextColor="#999"
            />
          </View>

          {/* Choose Destination Button */}
          <TouchableOpacity style={styles.chooseButton} onPress={handleGenerateRoute}>
            <Ionicons name="send" size={20} color="white" />
            <Text style={styles.chooseButtonText}>Elegir destino</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 0,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingInputsContainer: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E5A96',
  },
  inputsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  chooseButton: {
    backgroundColor: '#1E5A96',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  chooseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
