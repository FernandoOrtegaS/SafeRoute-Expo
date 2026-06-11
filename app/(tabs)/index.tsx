import { Alert, Animated, StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import MapView, { LatLng, Region } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

interface RouteInfo {
  duration: number;
  distance: number;
}

export default function HomeScreen() {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [originInput, setOriginInput] = useState('Elegir ubicación actual');
  const [destinationInput, setDestinationInput] = useState('');
  const [showInputs, setShowInputs] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<string | LatLng>('Elegir ubicación actual');
  const [routeDestination, setRouteDestination] = useState<string | LatLng>('');
  const [initRegion, setInitRegion] = useState<Region | undefined>(undefined);
  const [destinationSuggestions, setDestinationSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const mapRef = useRef<MapView>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnim = useRef(new Animated.Value(400)).current;

  const GOOGLE_MAPS_APIKEY = 'AIzaSyBdLccbhV2MPNVXgs4PEISQCmE8LY9A7e0';

  // Animate sheet in when routeInfo is set
  useEffect(() => {
    if (routeInfo !== null) {
      sheetAnim.setValue(400);
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    }
  }, [routeInfo]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
          setInitRegion({ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 });
        } else {
          Alert.alert('Permiso de ubicación', 'Necesitamos acceso a tu ubicación para mostrar dónde estás en el mapa.');
        }
      } catch (error) {
        console.warn('Error al solicitar permisos de ubicación:', error);
      }
    };
    requestLocationPermission();
  }, []);

  const fetchDestinationSuggestions = (text: string) => {
    setDestinationInput(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) {
      setDestinationSuggestions([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_APIKEY}&language=es`;
        if (userLocation) url += `&location=${userLocation.latitude},${userLocation.longitude}&radius=50000`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.predictions) {
          setDestinationSuggestions(data.predictions.slice(0, 5).map((p: any) => ({ description: p.description, place_id: p.place_id })));
        }
      } catch (e) {
        console.error('Error fetching suggestions:', e);
      }
    }, 400);
  };

  const handleSelectSuggestion = (description: string) => {
    setDestinationInput(description);
    setDestinationSuggestions([]);
  };

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

  const clearRoute = () => {
    Animated.timing(sheetAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(() => {
      setRouteInfo(null);
      setRouteDestination('');
      setDestinationInput('');
      setOriginInput('Elegir ubicación actual');
      setRouteOrigin('Elegir ubicación actual');
    });
  };

  const handleCenterLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({ latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
    }
  };

  const currentRouteOrigin =
    typeof routeOrigin === 'string' && routeOrigin === 'Elegir ubicación actual' ? undefined : routeOrigin;
  const currentRouteDestination = routeDestination !== '' ? routeDestination : undefined;

  if (!initRegion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Obteniendo tu ubicación segura...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider="google"
        initialRegion={initRegion}
        showsUserLocation={true}
        zoomEnabled={true}
        rotateEnabled={false}
        scrollEnabled={true}
        pitchEnabled={false}
      >
        {currentRouteDestination && currentRouteOrigin && (
          <MapViewDirections
            origin={currentRouteOrigin}
            destination={currentRouteDestination}
            apikey={GOOGLE_MAPS_APIKEY}
            mode="WALKING"
            strokeWidth={10}
            strokeColor="#1E5A96"
            onReady={(result) => {
              setRouteInfo({
                duration: Math.round(result.duration),
                distance: parseFloat(result.distance.toFixed(1)),
              });
              if (mapRef.current) {
                mapRef.current.fitToCoordinates(result.coordinates, {
                  edgePadding: { top: 100, right: 50, bottom: 330, left: 50 },
                  animated: true,
                });
              }
            }}
          />
        )}
      </MapView>

      {!routeInfo && (
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowInputs((prev) => !prev)}>
            <Text style={styles.headerTitle}>{showInputs ? 'Cerrar destino' : 'Elegir destino'}</Text>
            <Ionicons name={showInputs ? 'chevron-up' : 'chevron-down'} size={20} color="#1E5A96" />
          </TouchableOpacity>
        </View>
      )}

      {showInputs && !routeInfo && (
        <View style={styles.floatingInputsContainer}>
          <View style={styles.inputsContainer}>
            <View style={styles.inputRow}>
              <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Elegir ubicación actual" value={originInput} onChangeText={setOriginInput} placeholderTextColor="#999" />
              <TouchableOpacity onPress={handleUseCurrentLocation}>
                <Ionicons name="sync" size={20} color="#1E5A96" />
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Buscar destino..." value={destinationInput} onChangeText={fetchDestinationSuggestions} placeholderTextColor="#999" />
              {destinationInput.length > 0 && (
                <TouchableOpacity onPress={() => { setDestinationInput(''); setDestinationSuggestions([]); }}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            {destinationSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {destinationSuggestions.map((s) => (
                  <TouchableOpacity key={s.place_id} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(s.description)}>
                    <Ionicons name="location-outline" size={16} color="#1E5A96" />
                    <Text style={styles.suggestionText} numberOfLines={2}>{s.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.chooseButton} onPress={handleGenerateRoute}>
              <Ionicons name="send" size={20} color="white" />
              <Text style={styles.chooseButtonText}>Elegir destino</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.myLocationButton} onPress={handleCenterLocation}>
        <Ionicons name="locate" size={24} color="#1E5A96" />
      </TouchableOpacity>

      {/* Route Bottom Sheet — only renders when route is ready */}
      {routeInfo !== null && <Animated.View style={[styles.routeSheet, { transform: [{ translateY: sheetAnim }] }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetDestRow}>
          <View style={styles.sheetDestIcon}>
            <Ionicons name="walk" size={20} color="#1E5A96" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.sheetDestLabel}>DESTINO</Text>
            <Text style={styles.sheetDestName} numberOfLines={1}>{destinationInput}</Text>
          </View>
          <TouchableOpacity onPress={clearRoute} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.rutaBadge}>
          <Ionicons name="sparkles" size={13} color="white" />
          <Text style={styles.rutaBadgeText}>RUTA ILUMINADA</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{routeInfo?.duration ?? '—'}</Text>
            <Text style={styles.statLabel}>MINUTOS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{routeInfo?.distance ?? '—'}</Text>
            <Text style={styles.statLabel}>KILÓMETROS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={styles.statSeguroText}>SEGURO</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.routeOption}>
          <View style={styles.routeOptionIconBox}>
            <Ionicons name="shield-checkmark" size={20} color="#1E5A96" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeOptionTitle}>Ruta más segura</Text>
            <Text style={styles.routeOptionSubtitle}>Evita zonas con reportes de incidentes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.routeOption, { borderBottomWidth: 0 }]}>
          <View style={styles.routeOptionIconBox}>
            <Ionicons name="git-compare-outline" size={20} color="#1E5A96" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeOptionTitle}>Comparar rutas</Text>
            <Text style={styles.routeOptionSubtitle}>Comparar rápida vs segura</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iniciarBtn}>
          <Text style={styles.iniciarBtnText}>Iniciar Ruta</Text>
        </TouchableOpacity>
      </Animated.View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 50 },
  headerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E5A96' },
  floatingInputsContainer: { position: 'absolute', top: 110, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16 },
  inputsContainer: { backgroundColor: 'white', borderRadius: 12, padding: 12, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#333' },
  chooseButton: { backgroundColor: '#1E5A96', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12, gap: 8 },
  chooseButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  suggestionsContainer: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 4 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  suggestionText: { flex: 1, fontSize: 13, color: '#333' },
  myLocationButton: { position: 'absolute', bottom: 100, right: 20, backgroundColor: 'white', borderRadius: 30, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, zIndex: 10 },
  // Route Sheet
  routeSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 16, zIndex: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetDestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sheetDestIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF3FA', alignItems: 'center', justifyContent: 'center' },
  sheetDestLabel: { fontSize: 10, color: '#888', fontWeight: '600', letterSpacing: 0.5 },
  sheetDestName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginTop: 1 },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  rutaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E5A96', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', gap: 6, marginBottom: 16 },
  rutaBadgeText: { color: 'white', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '700', color: '#1A1A1A' },
  statLabel: { fontSize: 10, color: '#888', fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: '#E0E0E0' },
  statSeguroText: { fontSize: 11, fontWeight: '700', color: '#2E7D32', marginTop: 2 },
  routeOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 12 },
  routeOptionIconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF3FA', alignItems: 'center', justifyContent: 'center' },
  routeOptionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  routeOptionSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  iniciarBtn: { backgroundColor: '#1E5A96', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  iniciarBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
