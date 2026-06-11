import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  FlatList, Image, Modal, TextInput, Animated, Alert, Platform,
} from 'react-native';
import MapView, { Marker, LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

type IncidentCategory = 'robo' | 'trafico' | 'iluminacion' | 'infraestructura' | 'seguridad' | 'otro';
type IncidentUrgency = 'urgente' | 'normal';

interface Incident {
  id: string;
  category: IncidentCategory;
  title: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  urgency: IncidentUrgency;
  vote_count: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  robo: 'Robo',
  trafico: 'Tráfico',
  iluminacion: 'Iluminación',
  infraestructura: 'Infraestructura',
  seguridad: 'Seguridad',
  otro: 'Otro',
};

const CATEGORY_COLORS: Record<IncidentCategory, string> = {
  robo: '#E53935',
  trafico: '#FB8C00',
  iluminacion: '#FDD835',
  infraestructura: '#607D8B',
  seguridad: '#1E5A96',
  otro: '#9E9E9E',
};

const URGENCY_COLOR = '#FF6F00';
const GOOGLE_MAPS_APIKEY = 'AIzaSyBdLccbhV2MPNVXgs4PEISQCmE8LY9A7e0';

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  return `Hace ${Math.floor(diffHr / 24)} días`;
}

function IncidentCard({ item }: { item: Incident }) {
  const [address, setAddress] = useState(item.address ?? '');

  useEffect(() => {
    if (item.address) return; // ya tenemos la dirección guardada
    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${item.latitude},${item.longitude}&key=${GOOGLE_MAPS_APIKEY}&language=es&result_type=street_address|route`
    )
      .then(r => r.json())
      .then(data => {
        if (data.results?.[0]) setAddress(data.results[0].formatted_address);
        else setAddress(`${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`);
      })
      .catch(() => setAddress(`${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`));
  }, [item.id]);

  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${item.latitude},${item.longitude}` +
    `&zoom=16&size=600x220&scale=2` +
    `&markers=color:red%7C${item.latitude},${item.longitude}` +
    `&key=${GOOGLE_MAPS_APIKEY}`;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.meta}>
        <View style={[cardStyles.badge, { backgroundColor: item.urgency === 'urgente' ? URGENCY_COLOR : CATEGORY_COLORS[item.category] }]}>
          <Text style={cardStyles.badgeText}>
            {item.urgency === 'urgente' ? 'URGENTE' : CATEGORY_LABELS[item.category].toUpperCase()}
          </Text>
        </View>
        <Text style={cardStyles.time}>{timeAgo(item.created_at)}</Text>
      </View>

      <Text style={cardStyles.title}>{item.title}</Text>

      <View style={cardStyles.addressRow}>
        <Ionicons name="location" size={15} color="#E53935" />
        <Text style={cardStyles.addressText} numberOfLines={2}>
          {address || `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}
        </Text>
      </View>

      <View style={cardStyles.mapThumb}>
        <Image source={{ uri: mapUrl }} style={cardStyles.mapImage} resizeMode="cover" />
      </View>

      <TouchableOpacity style={cardStyles.detailsBtn}>
        <Text style={cardStyles.detailsBtnText}>Ver detalles</Text>
      </TouchableOpacity>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 16, marginBottom: 14, paddingBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700', color: 'white', letterSpacing: 0.5 },
  time: { fontSize: 12, color: '#999' },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', paddingHorizontal: 16, marginBottom: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  addressText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 18 },
  mapThumb: { marginHorizontal: 16, height: 150, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0F0', marginBottom: 12 },
  mapImage: { width: '100%', height: '100%' },
  detailsBtn: { marginHorizontal: 16, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  detailsBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DISTANCE_OPTIONS: Array<{ label: string; km: number | null }> = [
  { label: 'Todos', km: null },
  { label: '1 km',  km: 1   },
  { label: '5 km',  km: 5   },
  { label: '10 km', km: 10  },
  { label: '25 km', km: 25  },
];

const CATEGORY_OPTIONS: Array<{ value: IncidentCategory; label: string }> = [
  { value: 'robo', label: 'Robo' },
  { value: 'trafico', label: 'Tráfico' },
  { value: 'iluminacion', label: 'Poca iluminación' },
  { value: 'infraestructura', label: 'Infraestructura' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'otro', label: 'Otro' },
];

export default function AvisosScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<IncidentCategory | 'all'>('all');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  // Report form state
  const [reportCategory, setReportCategory] = useState<IncidentCategory>('robo');
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportLocation, setReportLocation] = useState<LatLng | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [reportAddressText, setReportAddressText] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const modalAnim = useRef(new Animated.Value(0)).current;
  const locationSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchIncidents();
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const { coords } = await Location.getCurrentPositionAsync({});
        const loc = { latitude: coords.latitude, longitude: coords.longitude };
        setUserLocation(loc);
        setReportLocation(loc);
      }
    })();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('incidents')
      .select('id, category, title, description, address, latitude, longitude, image_url, urgency, vote_count, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) console.error('fetchIncidents error:', JSON.stringify(error));
    if (data) setIncidents(data as Incident[]);
    setLoading(false);
  };

  const fetchLocationSuggestions = (text: string) => {
    setLocationInput(text);
    setLocationConfirmed(false); // el usuario está escribiendo, invalidar selección anterior
    if (locationSearchTimeout.current) clearTimeout(locationSearchTimeout.current);
    if (text.length < 3) { setLocationSuggestions([]); return; }
    locationSearchTimeout.current = setTimeout(async () => {
      try {
        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_APIKEY}&language=es`;
        if (userLocation) url += `&location=${userLocation.latitude},${userLocation.longitude}&radius=50000`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.predictions) {
          setLocationSuggestions(data.predictions.slice(0, 4).map((p: any) => ({ description: p.description, place_id: p.place_id })));
        }
      } catch (e) { console.error(e); }
    }, 400);
  };

  const handleSelectLocation = async (description: string, place_id: string) => {
    setLocationInput(description);
    setLocationSuggestions([]);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&key=${GOOGLE_MAPS_APIKEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.result?.geometry?.location) {
        setReportLocation({ latitude: data.result.geometry.location.lat, longitude: data.result.geometry.location.lng });
        setReportAddressText(description);
        setLocationConfirmed(true);
      }
    } catch (e) { console.error(e); }
  };

  const openModal = () => {
    setShowModal(true);
    Animated.spring(modalAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 12 }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowModal(false));
  };

  const submitReport = async () => {
    if (!locationConfirmed || !reportLocation) {
      Alert.alert('Ubicación requerida', 'Busca y selecciona una dirección de la lista.');
      return;
    }

    setSubmitting(true);

    // getUser() verifica el token contra el servidor (más fiable que getSession)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setSubmitting(false);
      Alert.alert('Sesión requerida', 'Debes iniciar sesión para reportar un incidente.');
      return;
    }

    // Upsert del perfil: crea si no existe, ignora si ya existe
    await supabase.from('profiles').upsert(
      {
        id: user.id,
        name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuario',
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    const finalTitle = reportTitle.trim() ||
      (CATEGORY_OPTIONS.find(c => c.value === reportCategory)?.label ?? 'Incidente');

    const { error } = await supabase.from('incidents').insert({
      user_id: user.id,
      category: reportCategory,
      title: finalTitle,
      description: reportDescription.trim() || null,
      address: reportAddressText || null,
      latitude: reportLocation.latitude,
      longitude: reportLocation.longitude,
      urgency: 'normal',
      is_active: true,
    });

    setSubmitting(false);

    if (error) {
      console.error('Supabase insert error:', JSON.stringify(error));
      Alert.alert('Error al enviar', `${error.message}\n\nCódigo: ${error.code}`);
      return;
    }

    // Limpiar formulario y refrescar lista
    setReportTitle('');
    setReportDescription('');
    setReportCategory('robo');
    setLocationInput('');
    setLocationSuggestions([]);
    setLocationConfirmed(false);
    setReportAddressText('');
    closeModal();
    await fetchIncidents();
  };

  const filtered = incidents.filter(i => {
    if (filter !== 'all' && i.category !== filter) return false;
    if (distanceKm !== null && userLocation) {
      const d = haversineKm(userLocation.latitude, userLocation.longitude, i.latitude, i.longitude);
      if (d > distanceKm) return false;
    }
    return true;
  });

  const filters: Array<{ key: IncidentCategory | 'all'; label: string }> = [
    { key: 'all', label: 'Todo' },
    { key: 'robo', label: 'Robo' },
    { key: 'trafico', label: 'Tráfico' },
    { key: 'iluminacion', label: 'Iluminación' },
    { key: 'infraestructura', label: 'Infraestructura' },
    { key: 'seguridad', label: 'Seguridad' },
  ];

  const modalTranslateY = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLogoRow}>
          <Image source={require('../../assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.title}>Avisos</Text>
        </View>
        <Text style={styles.subtitle}>Alertas de seguridad en tiempo real cerca de ti.</Text>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Distance chips */}
      <View style={styles.distanceRow}>
        <Ionicons name="navigate-outline" size={14} color="#888" style={{ marginRight: 4 }} />
        {DISTANCE_OPTIONS.map(d => (
          <TouchableOpacity
            key={String(d.km)}
            style={[styles.distanceChip, distanceKm === d.km && styles.distanceChipActive]}
            onPress={() => setDistanceKm(d.km)}
          >
            <Text style={[styles.distanceChipText, distanceKm === d.km && styles.distanceChipTextActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Incident list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchIncidents}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <IncidentCard item={item} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={52} color="#D0D0D0" />
              <Text style={styles.emptyText}>Sin incidentes activos</Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Ionicons name="add" size={22} color="white" />
        <Text style={styles.fabText}>Reportar incidente</Text>
      </TouchableOpacity>

      {/* Report Modal */}
      <Modal visible={showModal} transparent animationType="none" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} />
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: modalTranslateY }] }]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reportar Incidente</Text>
                <Text style={styles.modalSubtitle}>Tu reporte ayuda a mantener segura a la comunidad.</Text>
              </View>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category */}
              <Text style={styles.fieldLabel}>CATEGORÍA</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                <Text style={styles.pickerText}>
                  {CATEGORY_OPTIONS.find(c => c.value === reportCategory)?.label}
                </Text>
                <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.pickerDropdown}>
                  {CATEGORY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.pickerOption, reportCategory === opt.value && styles.pickerOptionActive]}
                      onPress={() => { setReportCategory(opt.value); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, reportCategory === opt.value && styles.pickerOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Title */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TÍTULO <Text style={{ color: '#BBB', fontWeight: '400' }}>(opcional)</Text></Text>
              <TextInput
                style={styles.titleInput}
                placeholder="Ej: Robo de bolso en plaza mayor"
                placeholderTextColor="#BBB"
                value={reportTitle}
                onChangeText={setReportTitle}
                maxLength={80}
              />

              {/* Description */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>DESCRIPCIÓN</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Describe brevemente lo ocurrido..."
                placeholderTextColor="#BBB"
                multiline
                numberOfLines={3}
                value={reportDescription}
                onChangeText={setReportDescription}
              />

              {/* Location */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>UBICACIÓN</Text>
              <View style={styles.locationInputRow}>
                <Ionicons name="location-outline" size={18} color="#666" />
                <TextInput
                  style={styles.locationInput}
                  placeholder="Buscar dirección..."
                  placeholderTextColor="#BBB"
                  value={locationInput}
                  onChangeText={fetchLocationSuggestions}
                />
                {locationInput.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setLocationInput('');
                    setLocationSuggestions([]);
                    setLocationConfirmed(false);
                    setReportAddressText('');
                  }}>
                    <Ionicons name="close-circle" size={16} color="#CCC" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => {
                  if (userLocation) {
                    setReportLocation(userLocation);
                    setLocationInput('Mi ubicación actual');
                    setLocationSuggestions([]);
                    // no confirma — el usuario debe elegir de la lista
                    setLocationConfirmed(false);
                  }
                }}>
                  <Ionicons name="locate" size={18} color="#1E5A96" />
                </TouchableOpacity>
              </View>

              {locationSuggestions.length > 0 && (
                <View style={styles.locationSuggestions}>
                  {locationSuggestions.map(s => (
                    <TouchableOpacity
                      key={s.place_id}
                      style={styles.locationSuggestionItem}
                      onPress={() => handleSelectLocation(s.description, s.place_id)}
                    >
                      <Ionicons name="location-outline" size={14} color="#1E5A96" />
                      <Text style={styles.locationSuggestionText} numberOfLines={2}>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {reportLocation && (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.miniMap}
                    provider="google"
                    region={{ ...reportLocation, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Marker coordinate={reportLocation} />
                  </MapView>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, (!locationConfirmed || submitting) && styles.submitBtnDisabled]}
                onPress={submitReport}
                disabled={!locationConfirmed || submitting}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Enviando...' : 'Enviar reporte'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: { paddingTop: Platform.OS === 'ios' ? 52 : 32, paddingHorizontal: 20, paddingBottom: 6, backgroundColor: 'white' },
  headerLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  headerLogo: { width: 28, height: 28 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  filtersScroll: { flexGrow: 0, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filtersRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip: { height: 28, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  chipActive: { backgroundColor: '#1E5A96', borderColor: '#1E5A96' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#666', lineHeight: 16 },
  chipTextActive: { color: 'white', fontWeight: '600' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 6 },
  distanceChip: { height: 26, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  distanceChipActive: { backgroundColor: '#E8F0FB', borderColor: '#1E5A96' },
  distanceChipText: { fontSize: 11, fontWeight: '500', color: '#666' },
  distanceChipTextActive: { color: '#1E5A96', fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 160 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700', color: 'white', letterSpacing: 0.5 },
  timeText: { fontSize: 12, color: '#999' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationText: { fontSize: 13, color: '#888', flex: 1 },
  incidentImage: { width: '100%', height: 160, borderRadius: 10, marginBottom: 12 },
  detailsBtn: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  detailsBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: '#BBB' },
  fab: { position: 'absolute', bottom: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E5A96', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, gap: 8, shadowColor: '#1E5A96', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  fabText: { color: 'white', fontSize: 15, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  modalSubtitle: { fontSize: 13, color: '#888', marginTop: 4, maxWidth: '85%' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.8, marginBottom: 8 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  pickerText: { fontSize: 15, color: '#333' },
  pickerDropdown: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  pickerOptionActive: { backgroundColor: '#EEF3FA' },
  pickerOptionText: { fontSize: 15, color: '#333' },
  pickerOptionTextActive: { color: '#1E5A96', fontWeight: '600' },
  titleInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: '#333' },
  descInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#333', minHeight: 90, textAlignVertical: 'top' },
  locationInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 4 },
  locationInput: { flex: 1, fontSize: 14, color: '#333' },
  locationSuggestions: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  locationSuggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  locationSuggestionText: { flex: 1, fontSize: 13, color: '#333' },
  mapContainer: { borderRadius: 14, overflow: 'hidden', height: 150, marginBottom: 8 },
  miniMap: { width: '100%', height: '100%' },
  submitBtn: { backgroundColor: '#1E5A96', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  submitBtnDisabled: { backgroundColor: '#B0BEC5' },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
