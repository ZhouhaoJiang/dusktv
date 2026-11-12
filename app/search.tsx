import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import CinemaSearch from '@/components/cinema/CinemaSearch';
import { RemoteControlModal } from '@/components/RemoteControlModal';
import { useCinemaNavigation } from '@/hooks/useCinemaNavigation';
import { api, SearchResult } from '@/services/api';
import { SearchHistoryManager } from '@/services/storage';
import { useRemoteControlStore } from '@/stores/remoteControlStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function SearchScreen() {
  const navigation = useCinemaNavigation();
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const { showModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  useEffect(() => {
    let active = true;
    mounted.current = true;
    SearchHistoryManager.get().then(value => { if (active) setHistory(value); }).catch(() => {});
    return () => { active = false; mounted.current = false; };
  }, []);
  const handleSearch = useCallback(async (value: string) => {
    const term = value.trim();
    if (!term) return;
    const token = ++request.current;
    Keyboard.dismiss(); setKeyword(term); setSubmitted(term); setLoading(true); setError(null); setResults([]);
    try {
      const response = await api.searchVideos(term);
      if (!mounted.current || token !== request.current) return;
      setResults(response.results);
      setHistory(previous => [term, ...previous.filter(entry => entry !== term)].slice(0, 20));
      SearchHistoryManager.add(term).catch(() => {});
    } catch {
      if (mounted.current && token === request.current) setError('无法连接影片服务器，请检查网络或服务器设置后重试。');
    } finally { if (mounted.current && token === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      handleSearch(lastMessage.split('_')[0]);
      clearMessage();
    }
  }, [lastMessage, targetPage, clearMessage, handleSearch]);
  const clear = () => { request.current++; setKeyword(''); setSubmitted(''); setResults([]); setError(null); setLoading(false); };
  return <>
    <CinemaSearch {...navigation} keyword={keyword} submitted={submitted} history={history} loading={loading} error={error}
      items={results.map(item => ({ ...item, id: String(item.id), sourceName: item.source_name }))}
      imageUrl={poster => api.getImageProxyUrl(poster)} onChange={setKeyword} onSearch={handleSearch} onClear={clear}
      onOpen={item => router.push({ pathname: '/detail', params: { source: item.source, id: item.id, q: item.title } })}
      onClearHistory={() => Alert.alert('清除搜索记录', '将清除全部搜索记录。', [{ text: '取消', style: 'cancel' }, { text: '清除', style: 'destructive', onPress: async () => { try { await SearchHistoryManager.clear(); setHistory([]); } catch { Alert.alert('清除失败', '请稍后重试。'); } } }])}
      onRemoteInput={() => remoteInputEnabled ? showModal('search') : Alert.alert('启用手机输入', '在设置中开启远程输入后，即可用手机发送片名。', [{ text: '取消', style: 'cancel' }, { text: '去设置', onPress: () => navigation.onNavigate('settings') }])}
    />
    <RemoteControlModal />
  </>;
}
