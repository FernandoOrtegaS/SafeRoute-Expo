import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Switch, Alert, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../utils/supabase';

type IncidentCategory = 'robo' | 'trafico' | 'iluminacion' | 'infraestructura' | 'seguridad' | 'otro';

interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  member_since: string;
  share_location: boolean;
}

interface Incident {
  id: string;
  category: IncidentCategory;
  title: string;
  created_at: string;
  vote_count: number;
}

const CATEGORY_COLORS: Record<IncidentCategory, string> = {
  robo: '#E53935', trafico: '#FB8C00', iluminacion: '#FDD835',
  infraestructura: '#607D8B', seguridad: '#1E5A96', otro: '#9E9E9E',
};

function memberSince(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `Miembro desde el ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  return `Hace ${Math.floor(diffHr / 24)} días`;
}

export default function PerfilScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shareLocation, setShareLocation] = useState(false);
  const [userIncidents, setUserIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const [profileRes, incidentsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('incidents').select('id, category, title, created_at, vote_count')
          .eq('user_id', session.user.id).eq('is_active', true)
          .order('created_at', { ascending: false }).limit(10),
      ]);

      const authName = session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'Usuario';
      const authDate = session.user.created_at;

      if (profileRes.data) {
        const p = profileRes.data as Profile;
        // Si el perfil no tiene nombre (trigger no lo rellenó), usar datos de auth
        if (!p.name) p.name = authName;
        if (!p.member_since) p.member_since = authDate;
        setProfile(p);
        setShareLocation(p.share_location ?? false);
      } else {
        // Perfil aún no creado: construir uno temporal con datos de auth
        setProfile({
          id: session.user.id,
          name: authName,
          avatar_url: null,
          member_since: authDate,
          share_location: false,
        });
      }
      if (incidentsRes.data) setUserIncidents(incidentsRes.data as Incident[]);
    }
    setLoading(false);
  };

  const toggleShareLocation = async (value: boolean) => {
    setShareLocation(value);
    if (profile) {
      await supabase.from('profiles').update({ share_location: value }).eq('id', profile.id);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#888' }}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.headerTitle}>Safe Route</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{profile ? getInitials(profile.name) : '?'}</Text>
            </View>
            <TouchableOpacity style={styles.editBadge}>
              <Ionicons name="pencil" size={13} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'Usuario'}</Text>
          <Text style={styles.memberSince}>{profile ? memberSince(profile.member_since) : ''}</Text>
        </View>

        <View style={styles.divider} />

        {/* Options */}
        <View style={styles.optionsList}>
          <View style={styles.optionRow}>
            <View style={[styles.optionIconBox, { backgroundColor: '#EEF3FA' }]}>
              <Ionicons name="location" size={20} color="#1E5A96" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Compartir ubicación en tiempo real</Text>
              <Text style={styles.optionSubtitle}>Visible para tus contactos de confianza</Text>
            </View>
            <Switch value={shareLocation} onValueChange={toggleShareLocation} trackColor={{ false: '#E0E0E0', true: '#1E5A96' }} thumbColor="white" />
          </View>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/(tabs)/mis-avisos')}>
            <View style={[styles.optionIconBox, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="warning" size={20} color="#FB8C00" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Mis avisos</Text>
              <Text style={styles.optionSubtitle}>Ver los incidentes que has reportado</Text>
            </View>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{userIncidents.length}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.optionRow}>
            <View style={[styles.optionIconBox, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="people" size={20} color="#E53935" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Contactos de emergencia</Text>
              <Text style={styles.optionSubtitle}>Gestionar alertas directas</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.optionRow}>
            <View style={[styles.optionIconBox, { backgroundColor: '#F3F3F3' }]}>
              <Ionicons name="settings" size={20} color="#555" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Configuración</Text>
              <Text style={styles.optionSubtitle}>Preferencias y privacidad</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.optionRow}>
            <View style={[styles.optionIconBox, { backgroundColor: '#EEF3FA' }]}>
              <Ionicons name="time" size={20} color="#1E5A96" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Historial de rutas</Text>
              <Text style={styles.optionSubtitle}>Revisar tus trayectos pasados</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 58 : 38, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 28, height: 28 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  scrollContent: { paddingBottom: 120 },
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: 'white' },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E5A96', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 28, fontWeight: '700', color: 'white' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#1E5A96', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  profileName: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  memberSince: { fontSize: 13, color: '#888' },
  divider: { height: 8, backgroundColor: '#F0F0F0' },
  optionsList: { backgroundColor: 'white', marginBottom: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  optionIconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  optionSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  separator: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 76 },
  badgeCount: { backgroundColor: '#FFF3E0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 },
  badgeCountText: { fontSize: 12, fontWeight: '700', color: '#FB8C00' },
  // Sign out
  signOutBtn: { marginHorizontal: 20, marginTop: 16, borderWidth: 1.5, borderColor: '#E53935', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'white' },
  signOutText: { color: '#E53935', fontSize: 16, fontWeight: '600' },
});
