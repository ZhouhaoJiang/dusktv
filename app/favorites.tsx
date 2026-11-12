import React, { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import CinemaLibrary from '@/components/cinema/CinemaLibrary';
import { useCinemaNavigation } from '@/hooks/useCinemaNavigation';
import useFavoritesStore from '@/stores/favoritesStore';
import { api } from '@/services/api';
export default function FavoritesScreen() {
  const { favorites, loading, error, fetchFavorites } = useFavoritesStore();
  const navigation = useCinemaNavigation();
  const router = useRouter();
  useFocusEffect(useCallback(() => { fetchFavorites(); }, [fetchFavorites]));
  return <CinemaLibrary {...navigation} loading={loading} error={error} onRetry={fetchFavorites} imageUrl={poster => api.getImageProxyUrl(poster)}
    items={favorites.map(item => { const [source, ...ids] = item.key.split('+'); return { id: ids.join('+'), source, title: item.title, poster: item.cover, year: item.year, sourceName: item.source_name }; })}
    onOpen={item => router.push({ pathname: '/detail', params: { source: item.source, id: item.id, q: item.title } })} />;
}
