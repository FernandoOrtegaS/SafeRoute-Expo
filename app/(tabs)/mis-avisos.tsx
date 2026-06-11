import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, FlatList,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../utils/supabase';

type IncidentCategory = 'robo' | 'trafico' | 'iluminacion' | 'infraestructura' | 'seguridad' | 'otro';

interface Incident {
  id: string;
  category: IncidentCategory;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  urgency: 'urgente' | 'normal';
  vote_count: number;
  created_at: string;
  is_active: boolean;
}

const CATEGORY_CONFIG: Record<IncidentCategory, { label: string; color: string; icon: string }> = {
  robo:            { label: 'Robo',            color: '#E53935', icon: 'shield-outline' },
  trafico:         { label: 'Tráfico',         color: '#FB8C00', icon: 'car-outline' },
  iluminacion:     { label: 'Iluminación',     color: '#F9A825', icon: 'bulb-outline' },
  infraestructura: { label: 'Infraestructura', color: '#607D8B', icon: 'construct-outline' },
  seguridad:       { label: 'Seguridad',       color: '#1E5A96', icon: 'warning-outline' },
  otro:            { label: 'Otro',            color: '#9E9E9E', icon: 'ellipsis-horizontal-circle-outline' },
};

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `Hace ${diffDay} día${diffDay > 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MisAvisosScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIncidents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('incidents')
      .select('id, category, title, description, latitude, longitude, urgency, vote_count, created_at, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setIncidents(data as Incident[]);
  }, []);

  useEffect(() => {
    fetchIncidents().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchIncidents();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Incident }) => {
    const cfg = CATEGORY_CONFIG[item.category];
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: cfg.color + '18' }]}>
            <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={[styles.categoryBadge, { backgroundColor: cfg.color + '18' }]}>
              <Text style={[styles.categoryText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {item.urgency === 'urgente' && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>URGENTE</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.cardFooter}>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
            <View style={styles.voteRow}>
              <Ionicons name="thumbs-up-outline" size={13} color="#888" />
              <Text style={styles.voteText}>{item.vote_count}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#4CAF50' : '#BDBDBD' }]} />
            <Text style={styles.statusText}>{item.is_active ? 'Activo' : 'Expirado'}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis avisos</Text>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>{incidents.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1E5A96" />
        </View>
      ) : incidents.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={56} color="#E0E0E0" />
          <Text style={styles.emptyTitle}>Sin avisos aún</Text>
          <Text style={styles.emptySubtitle}>Los incidentes que reportes aparecerán aquí</Text>
          <TouchableOpacity style={styles.goBtn} onPress={() => router.replace('/(tabs)/avisos')}>
            <Text style={styles.goBtnText}>Reportar un incidente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E5A96" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 58 : 38, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerCount: { backgroundColor: '#EEF3FA', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  headerCountText: { fontSize: 13, fontWeight: '700', color: '#1E5A96' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: '#999', textAlign: 'center' },
  goBtn: { marginTop: 12, backgroundColor: '#1E5A96', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 },
  goBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardLeft: { paddingTop: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  urgentBadge: { backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  urgentText: { fontSize: 10, fontWeight: '800', color: '#E53935', letterSpacing: 0.5 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },
  cardDesc: { fontSize: 12, color: '#777', lineHeight: 17 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  timeText: { fontSize: 11, color: '#AAAAAA', flex: 1 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  voteText: { fontSize: 11, color: '#888' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: '#888' },
});
