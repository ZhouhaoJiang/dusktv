import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CinemaDetail from '@/components/cinema/CinemaDetail';
import { useCinemaNavigation } from '@/hooks/useCinemaNavigation';
import useDetailStore, { SearchResultWithResolution } from '@/stores/detailStore';
import { api } from '@/services/api';
const present = (item: SearchResultWithResolution) => ({ ...item, id: String(item.id), sourceName: item.source_name });
export default function DetailScreen() {
  const { q, source, id } = useLocalSearchParams<{ q: string; source?: string; id?: string }>();
  const router = useRouter();
  const navigation = useCinemaNavigation();
  const { detail, searchResults, loading, error, allSourcesLoaded, init, setDetail, abort, isFavorited, toggleFavorite } = useDetailStore();
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  useEffect(() => { if (q) init(q, source, id); return abort; }, [q, source, id, init, abort]);
  return <CinemaDetail {...navigation} item={detail ? present(detail) : null} sources={searchResults.map(present)} loading={loading} error={error} sourcesLoading={!allSourcesLoaded} favorited={isFavorited} favoriteBusy={favoriteBusy}
    onRetry={() => { if (q) init(q, source, id); }} imageUrl={poster => api.getImageProxyUrl(poster)}
    onPlay={episodeIndex => { if (!detail) return; abort(); router.push({ pathname: '/play', params: { title: detail.title, source: detail.source, id: String(detail.id), episodeIndex: String(episodeIndex) } }); }}
    onSource={item => { const original = searchResults.find(source => source.source === item.source && String(source.id) === item.id); if (original) setDetail(original); }}
    onFavorite={async () => { if (favoriteBusy) return; setFavoriteBusy(true); try { await toggleFavorite(); } catch { Alert.alert('收藏更新失败', '请稍后重试。'); } finally { setFavoriteBusy(false); } }}
  />;
}
