import { ActivityIndicator, Alert, Animated, Keyboard, StyleSheet, View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import MapView, { LatLng, Region, Marker, Callout, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

const customMapStyle = [
  {
    featureType: "poi", // "Points of Interest" (tiendas, restaurantes, bancos, etc.)
    stylers: [
      {
        visibility: "off",
      },
    ],
  },
  {
    featureType: "transit", // Transporte público (opcional, oculta íconos de paraderos de micro/metro)
    elementType: "labels.icon",
    stylers: [
      {
        visibility: "off",
      },
    ],
  }
];

interface StreetSegment {
  id: string;
  name: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  safety_score: number;
}

interface RouteOption {
  id: string;
  title: string;
  subtitle: string;
  coordinates: LatLng[];
  duration: number;
  distance: number;
  safetyScore: number;
  isFastest: boolean;
  isSafest: boolean;
}

interface Incident {
  id: string;
  category: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  urgency: string;
  vote_count: number;
}

const DEFAULT_SAFETY_SCORE = 100;
const STREET_MATCH_THRESHOLD_METERS = 45;

const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ latitude: latitude / 100000, longitude: longitude / 100000 });
  }

  return points;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (a: LatLng, b: LatLng) => {
  const earthRadius = 6371000;
  const latDelta = toRadians(b.latitude - a.latitude);
  const lonDelta = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const distancePointToSegmentMeters = (point: LatLng, start: LatLng, end: LatLng) => {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(toRadians(point.latitude));
  const pointX = point.longitude * metersPerDegreeLon;
  const pointY = point.latitude * metersPerDegreeLat;
  const startX = start.longitude * metersPerDegreeLon;
  const startY = start.latitude * metersPerDegreeLat;
  const endX = end.longitude * metersPerDegreeLon;
  const endY = end.latitude * metersPerDegreeLat;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLength = segmentX * segmentX + segmentY * segmentY;

  if (segmentLength === 0) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const projection = Math.max(
    0,
    Math.min(1, ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLength)
  );
  const closestX = startX + projection * segmentX;
  const closestY = startY + projection * segmentY;

  return Math.hypot(pointX - closestX, pointY - closestY);
};

const getRouteSafetyScore = (coordinates: LatLng[], streetSegments: StreetSegment[]) => {
  if (coordinates.length < 2) return DEFAULT_SAFETY_SCORE;

  let weightedScore = 0;
  let totalDistance = 0;

  for (let index = 1; index < coordinates.length; index++) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentDistance = distanceMeters(start, end);
    const midpoint = {
      latitude: (start.latitude + end.latitude) / 2,
      longitude: (start.longitude + end.longitude) / 2,
    };

    let nearestDistance = Infinity;
    let nearestScore = DEFAULT_SAFETY_SCORE;

    streetSegments.forEach((segment) => {
      const streetStart = {
        latitude: Number(segment.start_latitude),
        longitude: Number(segment.start_longitude),
      };
      const streetEnd = {
        latitude: Number(segment.end_latitude),
        longitude: Number(segment.end_longitude),
      };
      const distance = distancePointToSegmentMeters(midpoint, streetStart, streetEnd);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestScore = Number(segment.safety_score ?? DEFAULT_SAFETY_SCORE);
      }
    });

    const score = nearestDistance <= STREET_MATCH_THRESHOLD_METERS ? nearestScore : DEFAULT_SAFETY_SCORE;
    weightedScore += score * segmentDistance;
    totalDistance += segmentDistance;
  }

  return totalDistance > 0 ? weightedScore / totalDistance : DEFAULT_SAFETY_SCORE;
};

const formatDirectionsPoint = (point: string | LatLng) => {
  if (typeof point === 'string') {
    return encodeURIComponent(point);
  }

  return `${point.latitude},${point.longitude}`;
};

export default function HomeScreen() {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [showInputs, setShowInputs] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<string | LatLng>('Elegir ubicación actual');
  const [routeDestination, setRouteDestination] = useState<string | LatLng>('');
  const [initRegion, setInitRegion] = useState<Region | undefined>(undefined);
  const [originSuggestions, setOriginSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRouteComparison, setShowRouteComparison] = useState(false);
  const [mapDestinationPin, setMapDestinationPin] = useState<LatLng | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [streetSegments, setStreetSegments] = useState<StreetSegment[]>([]);
  
  const mapRef = useRef<MapView>(null);
  const originSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnim = useRef(new Animated.Value(400)).current;

  const GOOGLE_MAPS_APIKEY = 'AIzaSyBdLccbhV2MPNVXgs4PEISQCmE8LY9A7e0';

  // Animate sheet in when a route is selected.
  useEffect(() => {
    if (selectedRoute !== null) {
      sheetAnim.setValue(400);
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    }
  }, [selectedRoute]);

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

  const fetchPlaceSuggestions = async (text: string) => {
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_APIKEY}&language=es`;
    if (userLocation) url += `&location=${userLocation.latitude},${userLocation.longitude}&radius=50000`;
    const res = await fetch(url);
    const data = await res.json();

    return data.predictions
      ? data.predictions.slice(0, 5).map((p: any) => ({ description: p.description, place_id: p.place_id }))
      : [];
  };

  const fetchOriginSuggestions = (text: string) => {
    setOriginInput(text);
    setRouteOrigin(text);
    if (originSearchTimeout.current) clearTimeout(originSearchTimeout.current);
    if (text.length < 3) {
      setOriginSuggestions([]);
      return;
    }
    originSearchTimeout.current = setTimeout(async () => {
      try {
        setOriginSuggestions(await fetchPlaceSuggestions(text));
      } catch (e) {
        console.error('Error fetching origin suggestions:', e);
      }
    }, 400);
  };

  const fetchDestinationSuggestions = (text: string) => {
    setDestinationInput(text);
    if (destinationSearchTimeout.current) clearTimeout(destinationSearchTimeout.current);
    if (text.length < 3) {
      setDestinationSuggestions([]);
      return;
    }
    destinationSearchTimeout.current = setTimeout(async () => {
      try {
        setDestinationSuggestions(await fetchPlaceSuggestions(text));
      } catch (e) {
        console.error('Error fetching suggestions:', e);
      }
    }, 400);
  };

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const { data, error } = await supabase
          .from('incidents')
          .select('id, category, title, description, latitude, longitude, urgency, vote_count')
          .eq('is_active', true); // Solo mostramos los que están activos en el mapa

        if (error) {
          console.error('Error fetching incidents:', error.message);
          return;
        }

        if (data) {
          setIncidents(data);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error('Error en fetchIncidents:', error.message);
        } else {
          console.error('Error en fetchIncidents:', String(error));
        }
      }
    };

    fetchIncidents();
  }, []);

  useEffect(() => {
    const fetchStreets = async () => {
      try {
        const { data, error } = await supabase
          .from('street_segments')
          .select('*');

        if (error) {
          console.error('Error fetching streets:', error.message);
          return;
        }

        if (data) {
          setStreetSegments(data);
        }
      } catch (error) {
        console.error('Error en fetchStreets:', String(error));
      }
    };

    fetchStreets();
  }, []);

  const handleSelectOriginSuggestion = (description: string) => {
    setOriginInput(description);
    setRouteOrigin(description);
    setOriginSuggestions([]);
  };

  const handleSelectSuggestion = (description: string) => {
    setDestinationInput(description);
    setDestinationSuggestions([]);
  };

  const handleUseCurrentLocation = () => {
    if (userLocation) {
      setOriginInput('');
      setRouteOrigin(userLocation);
      setOriginSuggestions([]);
    } else {
      Alert.alert('Ubicación', 'Ubicación actual no disponible');
    }
  };

  const fillDestinationFromCoordinate = async (coordinate: LatLng) => {
    setShowInputs(true);
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
    setSelectedRoute(null);
    setRouteOptions([]);
    setShowRouteComparison(false);
    setMapDestinationPin(null);
    setRouteDestination('');
    setDestinationInput('Buscando dirección...');

    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}` +
        `&key=${GOOGLE_MAPS_APIKEY}&language=es&result_type=street_address|route`;
      const response = await fetch(url);
      const data = await response.json();
      const address =
        data.results?.[0]?.formatted_address ??
        `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;

      setDestinationInput(address);
    } catch (error) {
      console.error('Error obteniendo dirección:', error);
      setDestinationInput(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
    }
  };

  const handleMapLongPress = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    Keyboard.dismiss();
    setSelectedRoute(null);
    setRouteOptions([]);
    setShowRouteComparison(false);
    setShowInputs(false);
    setRouteDestination('');
    setMapDestinationPin(coordinate);
  };

  const fitRouteToMap = (coordinates: LatLng[]) => {
    if (mapRef.current && coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 330, left: 50 },
        animated: true,
      });
    }
  };

  const selectRoute = (route: RouteOption) => {
    setSelectedRoute(route);
    setRouteDestination(destinationInput);
    setShowRouteComparison(false);
    fitRouteToMap(route.coordinates);
  };

  const fetchRouteOptions = async (origin: string | LatLng, destination: string | LatLng) => {
    setRouteLoading(true);
    setRouteOptions([]);
    setSelectedRoute(null);
    setShowRouteComparison(false);

    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json?origin=${formatDirectionsPoint(origin)}` +
        `&destination=${formatDirectionsPoint(destination)}` +
        `&key=${GOOGLE_MAPS_APIKEY}&mode=walking&language=es&alternatives=true`;
      const response = await fetch(url);
      const json = await response.json();

      if (json.status !== 'OK' || !json.routes?.length) {
        throw new Error(json.error_message || json.status || 'No se encontraron rutas');
      }

      const options: RouteOption[] = json.routes
        .map((route: any, index: number) => {
          const detailedCoordinates =
            route.legs?.flatMap((leg: any) =>
              leg.steps?.flatMap((step: any) =>
                step.polyline?.points ? decodePolyline(step.polyline.points) : []
              ) ?? []
            ) ?? [];
          const overviewCoordinates = route.overview_polyline?.points
            ? decodePolyline(route.overview_polyline.points)
            : [];
          const coordinates = detailedCoordinates.length > 1 ? detailedCoordinates : overviewCoordinates;
          const distance = route.legs.reduce((total: number, leg: any) => total + leg.distance.value, 0) / 1000;
          const duration = route.legs.reduce((total: number, leg: any) => total + leg.duration.value, 0) / 60;

          return {
            id: String(index),
            title: `Ruta ${index + 1}`,
            subtitle: '',
            coordinates,
            duration,
            distance,
            safetyScore: getRouteSafetyScore(coordinates, streetSegments),
            isFastest: false,
            isSafest: false,
          };
        })
        .filter((route: RouteOption) => route.coordinates.length > 1);

      if (!options.length) {
        throw new Error('No se pudo dibujar la ruta');
      }

      const fastestRoute = [...options].sort((a, b) => a.duration - b.duration)[0];
      const safestRoute = [...options].sort((a, b) => {
        if (b.safetyScore !== a.safetyScore) return b.safetyScore - a.safetyScore;
        return a.duration - b.duration;
      })[0];
      const labeledOptions = options.map((option) => ({
        ...option,
        title:
          option.id === safestRoute.id
            ? 'Ruta más segura'
            : option.id === fastestRoute.id
              ? 'Ruta rápida'
              : option.title,
        subtitle: `Seguridad ${Math.round(option.safetyScore)}/100`,
        isFastest: option.id === fastestRoute.id,
        isSafest: option.id === safestRoute.id,
      }));
      const selected = labeledOptions.find((option) => option.id === fastestRoute.id) ?? labeledOptions[0];

      setRouteOptions(labeledOptions);
      selectRoute(selected);
    } catch (error) {
      Alert.alert('Ruta', error instanceof Error ? error.message : 'No se pudo calcular la ruta');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleGenerateRoute = () => {
    if (!destinationInput.trim()) {
      Alert.alert('Destino', 'Ingresa un destino para generar la ruta');
      return;
    }
    const trimmedOrigin = originInput.trim();
    if (!trimmedOrigin && !userLocation) {
      Alert.alert('Ubicación', 'Ubicación actual no disponible');
      return;
    }
    let nextOrigin: string | LatLng = trimmedOrigin;
    if (!trimmedOrigin && userLocation) {
      nextOrigin = userLocation;
    }
    setRouteDestination(destinationInput);
    setRouteOrigin(nextOrigin);
    setOriginSuggestions([]);
    setShowInputs(false);
    fetchRouteOptions(nextOrigin, destinationInput);
  };

  const clearRoute = () => {
    Animated.timing(sheetAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(() => {
      setSelectedRoute(null);
      setRouteOptions([]);
      setShowRouteComparison(false);
      setMapDestinationPin(null);
      setRouteDestination('');
      setDestinationInput('');
      setOriginInput('');
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
  const safestRoute = routeOptions.find((route) => route.isSafest);
  const fastestRoute = routeOptions.find((route) => route.isFastest);
  const comparisonRoutes = [safestRoute, fastestRoute]
    .filter((route): route is RouteOption => route !== undefined)
    .filter((route, index, routes) => routes.findIndex((item) => item.id === route.id) === index);

  if (!initRegion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Obteniendo tu ubicación segura...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
        customMapStyle={customMapStyle}
        onPress={() => Keyboard.dismiss()}
        onLongPress={handleMapLongPress}
      >
        {selectedRoute && (
          <Polyline
            coordinates={selectedRoute.coordinates}
            strokeWidth={10}
            strokeColor="#1E5A96"
            lineCap="round"
            lineJoin="round"
            zIndex={10}
          />
        )}
        {mapDestinationPin && (
          <Marker
            coordinate={mapDestinationPin}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => fillDestinationFromCoordinate(mapDestinationPin)}
          >
            <View style={styles.mapDestinationMarker}>
              <TouchableOpacity
                style={styles.mapDestinationMarkerButton}
                onPress={() => fillDestinationFromCoordinate(mapDestinationPin)}
              >
                <Ionicons name="navigate" size={16} color="white" />
                <Text style={styles.mapDestinationMarkerButtonText}>Ir hasta aquí</Text>
              </TouchableOpacity>
              <View style={styles.mapDestinationPin}>
                <Ionicons name="location" size={26} color="white" />
              </View>
            </View>
          </Marker>
        )}
        {incidents.map((incident) => {
          const urgencyLevel = incident.urgency?.toLowerCase() || 'normal';
          let dotColor = '#FF9800'; // Naranja por defecto (normal)
          
          if (urgencyLevel === 'alta' || urgencyLevel === 'urgente' || urgencyLevel === 'high') {
            dotColor = '#F44336'; // Rojo (alta)
          } else if (urgencyLevel === 'baja' || urgencyLevel === 'no_urgente') {
            dotColor = '#FFEB3B'; // Amarillo (baja)
          }

          return (
            <Marker
              key={incident.id}
              coordinate={{
                latitude: incident.latitude,
                longitude: incident.longitude,
              }}
            >
              {/* --- AQUÍ CREAMOS EL PIN PERSONALIZADO --- */}
              <View style={{
                width: 24, 
                height: 24,
                borderRadius: 12, // La mitad del width/height para hacerlo circular
                backgroundColor: dotColor,
                borderWidth: 2,
                borderColor: 'white', // Borde blanco para que resalte sobre las calles
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 3,
                elevation: 5,
              }} />

              {/* El Callout sigue funcionando igual */}
              <Callout tooltip={false}>
                <View style={{ padding: 8, minWidth: 160 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
                    {incident.title}
                  </Text>
                  
                  <Text style={{ fontSize: 13, color: '#1E5A96', fontWeight: '600', marginBottom: 2 }}>
                    Categoría: {incident.category}
                  </Text>
                  
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    Urgencia: <Text style={{fontWeight: 'bold'}}>{incident.urgency}</Text> | Votos: {incident.vote_count}
                  </Text>
                  
                  {incident.description ? (
                    <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4, color: '#444' }}>
                      "{incident.description}"
                    </Text>
                  ) : null}
                </View>
              </Callout>
            </Marker>
          );
        })}
        {streetSegments.map((segment) => {
          const score = Number(segment.safety_score);
          let lineColor = 'rgba(76, 175, 80, 1)'; 
          
          if (score < 40) {
            lineColor = 'rgba(244, 67, 54, 1)'; 
          } else if (score >= 40 && score <= 70) {
            lineColor = 'rgba(255, 152, 0, 1)'; 
          }

          const startCoords = { latitude: Number(segment.start_latitude), longitude: Number(segment.start_longitude) };
          const endCoords = { latitude: Number(segment.end_latitude), longitude: Number(segment.end_longitude) };

          return (
            <React.Fragment key={segment.id}>
              {/* 1. La línea principal */}
              <Polyline
                coordinates={[startCoords, endCoords]}
                strokeColor={lineColor}
                fillColor={lineColor}
                strokeColors={[lineColor]}
                strokeWidth={8}
                lineCap="round" // Se deja puesto porque en Android sí funciona mágicamente
                lineJoin="round"
                zIndex={5}
                geodesic={true}
              />
              
              {/* 2. Círculo para redondear el INICIO de la línea (Truco para iOS) */}
              <Circle
                center={startCoords}
                radius={3}
                fillColor={lineColor}
                strokeColor="transparent"
                zIndex={5}
              />

              {/* 3. Círculo para redondear el FIN de la línea (Truco para iOS) */}
              <Circle
                center={endCoords}
                radius={3}
                fillColor={lineColor}
                strokeColor="transparent"
                zIndex={5}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {!selectedRoute && !routeLoading && (
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowInputs((prev) => !prev)}>
            <Text style={styles.headerTitle}>{showInputs ? 'Cerrar destino' : 'Elegir destino'}</Text>
            <Ionicons name={showInputs ? 'chevron-up' : 'chevron-down'} size={20} color="#1E5A96" />
          </TouchableOpacity>
        </View>
      )}

      {showInputs && !selectedRoute && !routeLoading && (
        <View style={styles.floatingInputsContainer}>
          <View style={styles.inputsContainer}>
            <View style={styles.inputRow}>
              <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Ubicación actual" value={originInput} onChangeText={fetchOriginSuggestions} placeholderTextColor="#999" />
              {originInput.length > 0 && (
                <TouchableOpacity onPress={() => { setOriginInput(''); setRouteOrigin('Elegir ubicación actual'); setOriginSuggestions([]); }}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleUseCurrentLocation}>
                <Ionicons name="sync" size={20} color="#1E5A96" />
              </TouchableOpacity>
            </View>
            {originSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {originSuggestions.map((s) => (
                  <TouchableOpacity key={s.place_id} style={styles.suggestionItem} onPress={() => handleSelectOriginSuggestion(s.description)}>
                    <Ionicons name="location-outline" size={16} color="#1E5A96" />
                    <Text style={styles.suggestionText} numberOfLines={2}>{s.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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

      {routeLoading && (
        <View style={styles.loadingRoute}>
          <ActivityIndicator color="#1E5A96" />
          <Text style={styles.loadingRouteText}>Calculando rutas...</Text>
        </View>
      )}

      {/* Route Bottom Sheet — only renders when route is ready */}
      {selectedRoute !== null && <Animated.View style={[styles.routeSheet, { transform: [{ translateY: sheetAnim }] }]}>
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
            <Text style={styles.statValue}>{Math.round(selectedRoute.duration)}</Text>
            <Text style={styles.statLabel}>MINUTOS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{selectedRoute.distance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>KILÓMETROS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={styles.statSeguroText}>SEGURO</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.routeOption}
          onPress={() => {
            if (safestRoute) selectRoute(safestRoute);
          }}
        >
          <View style={styles.routeOptionIconBox}>
            <Ionicons name="shield-checkmark" size={20} color="#1E5A96" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeOptionTitle}>Ruta más segura</Text>
            <Text style={styles.routeOptionSubtitle}>Evita zonas con reportes de incidentes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.routeOption, { borderBottomWidth: showRouteComparison ? 1 : 0 }]}
          onPress={() => setShowRouteComparison((value) => !value)}
        >
          <View style={styles.routeOptionIconBox}>
            <Ionicons name="git-compare-outline" size={20} color="#1E5A96" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeOptionTitle}>Comparar rutas</Text>
            <Text style={styles.routeOptionSubtitle}>Comparar rápida vs segura</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        {showRouteComparison && (
          <View style={styles.compareContainer}>
            {comparisonRoutes.map((route) => (
              <TouchableOpacity
                key={route.id}
                style={[
                  styles.compareRoute,
                  selectedRoute.id === route.id && styles.compareRouteSelected,
                ]}
                onPress={() => selectRoute(route)}
              >
                <View style={styles.compareRouteText}>
                  <Text style={styles.compareRouteTitle}>
                    {route.isSafest ? 'Ruta más segura' : 'Ruta rápida'}
                  </Text>
                  <Text style={styles.compareRouteSubtitle}>
                    {Math.round(route.duration)} min · {route.distance.toFixed(1)} km · Seguridad {Math.round(route.safetyScore)}/100
                  </Text>
                </View>
                {selectedRoute.id === route.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#2E7D32" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.iniciarBtn}>
          <Text style={styles.iniciarBtnText}>Iniciar Ruta</Text>
        </TouchableOpacity>
      </Animated.View>}
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 50 },
  headerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E5A96' },
  mapDestinationMarker: { alignItems: 'center' },
  mapDestinationMarkerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E5A96', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, gap: 6, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 7 },
  mapDestinationMarkerButtonText: { color: 'white', fontSize: 13, fontWeight: '700' },
  mapDestinationPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E5A96', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 6 },
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
  loadingRoute: { position: 'absolute', left: 24, right: 24, bottom: 120, backgroundColor: 'white', borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 8, zIndex: 15 },
  loadingRouteText: { color: '#1E5A96', fontSize: 14, fontWeight: '600' },
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
  compareContainer: { gap: 10, paddingVertical: 12 },
  compareRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E7EAF0', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  compareRouteSelected: { borderColor: '#1E5A96', backgroundColor: '#F1F6FC' },
  compareRouteText: { flex: 1, paddingRight: 10 },
  compareRouteTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  compareRouteSubtitle: { fontSize: 12, color: '#666', marginTop: 3 },
  iniciarBtn: { backgroundColor: '#1E5A96', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  iniciarBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
