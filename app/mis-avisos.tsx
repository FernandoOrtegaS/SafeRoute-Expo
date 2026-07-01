import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const CATEGORY_COLORS: Record<string, string> = {
  robo: '#FF4444', trafico: '#FF8C00', iluminacion: '#F59E0B',
  infraestructura: '#1E5A96', seguridad: '#2E7D32', otro: '#666',
};
const CATEGORY_LABELS: Record<string, string> = {
  robo: 'Robo', trafico: 'Tráfico', iluminacion: 'Iluminación',
  infraestructura: 'Infraestructura', seguridad: 'Seguridad', otro: 'Otro',
};

type Incident = {
  id: string; category: string; title: string;
  description: string | null; urgency: 'urgente' | 'normal';
  vote_count: number; created_at: string; is_active: boolean;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} días`;
}

export default function MisAvisosScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();
  const router = useRouter();

  const fetchMyIncidents = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('incidents')
      .select('id, category, title, description, urgency, vote_count, created_at, is_active')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setIncidents(data);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => { fetchMyIncidents(); }, [fetchMyIncidents]);

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar aviso', '¿Seguro que deseas eliminar este reporte?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('incidents').update({ is_active: false }).eq('id', id);
          setIncidents(prev => prev.filter(i => i.id !== id));
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Incident }) => {
    const catColor = CATEGORY_COLORS[item.category] || '#666';
    const catLabel = CATEGORY_LABELS[item.category] ?? item.category;
    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {item.urgency === 'urgente' && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>● URGENTE</Text>
              </View>
            )}
            <View style={[styles.catBadge, { backgroundColor: catColor + '22' }]}>
              <Text style={[styles.catBadgeText, { color: catColor }]}>{catLabel}</Text>
            </View>
            {!item.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>ELIMINADO</Text>
              </View>
            )}
          </View>
          <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>

        {item.description ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#888" />
            <Text style={styles.locationText} numberOfLines={2}>{item.description}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.voteRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#1E5A96" />
            <Text style={styles.voteText}>{item.vote_count} confirmaciones</Text>
          </View>
          {item.is_active && (
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={16} color="#E53935" />
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis avisos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1E5A96" /></View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={incidents.length === 0 ? styles.centered : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMyIncidents(); }} tintColor="#1E5A96" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={56} color="#ccc" />
              <Text style={styles.emptyTitle}>Sin avisos publicados</Text>
              <Text style={styles.emptyText}>Tus reportes aparecerán aquí</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF0F5' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  urgentBadge: { backgroundColor: '#FF44440F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  urgentText: { fontSize: 11, color: '#FF4444', fontWeight: '700' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  inactiveBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inactiveText: { fontSize: 11, color: '#999', fontWeight: '600' },
  timeAgo: { fontSize: 12, color: '#aaa' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 10 },
  locationText: { fontSize: 13, color: '#888', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteText: { fontSize: 13, color: '#1E5A96', fontWeight: '500' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0F0', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  deleteText: { fontSize: 13, color: '#E53935', fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#888', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#aaa', marginTop: 6 },
});
