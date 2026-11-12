import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { UNSTABLE_usePreventRemove as usePreventRemove } from '@react-navigation/native';
import CinemaSettings from '@/components/cinema/CinemaSettings';
import { UpdateSection } from '@/components/settings/UpdateSection';
import { useCinemaNavigation } from '@/hooks/useCinemaNavigation';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRemoteControlStore } from '@/stores/remoteControlStore';
import useAuthStore from '@/stores/authStore';
export default function SettingsScreen() {
  const navigation = useCinemaNavigation();
  const settings = useSettingsStore();
  const stack = useNavigation();
  const allowLeave = useRef(false);
  const edited = useRef(false);
  const [draft, setDraft] = useState(() => ({ api: settings.apiBaseUrl, m3u: settings.m3uUrl, remote: settings.remoteInputEnabled }));
  const remote = useRemoteControlStore();
  const { loadSettings } = settings;
  const { lastMessage, targetPage, clearMessage } = remote;
  const auth = useAuthStore();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [field, setField] = useState<'api' | 'livestream'>('api');
  useEffect(() => {
    let active = true;
    loadSettings().then(() => {
      if (active && !edited.current) { const value = useSettingsStore.getState(); setDraft({ api: value.apiBaseUrl, m3u: value.m3uUrl, remote: value.remoteInputEnabled }); }
    }).catch(() => Alert.alert('读取设置失败', '请稍后重试。'));
    return () => { active = false; };
  }, [loadSettings]);
  const discard = useCallback(() => { edited.current = false; setDirty(false); }, []);
  usePreventRemove(dirty, ({ data }) => {
    if (allowLeave.current) { stack.dispatch(data.action); return; }
    Alert.alert('设置尚未保存', '离开后将放弃未保存的更改。', [{ text: '继续编辑', style: 'cancel' }, { text: '放弃更改', style: 'destructive', onPress: () => { allowLeave.current = true; discard(); stack.dispatch(data.action); } }]);
  });
  useEffect(() => {
    if (lastMessage && !targetPage) {
      const value = lastMessage.split('_')[0];
      setDraft(previous => ({ ...previous, [field === 'api' ? 'api' : 'm3u']: value }));
      edited.current = true; setDirty(true); clearMessage();
    }
  }, [lastMessage, targetPage, clearMessage, field]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { settings.setApiBaseUrl(draft.api); settings.setM3uUrl(draft.m3u); settings.setRemoteInputEnabled(draft.remote); await settings.saveSettings(); setDraft(previous => ({ ...previous, api: useSettingsStore.getState().apiBaseUrl })); edited.current = false; setDirty(false); } catch { Alert.alert('保存失败', '请检查服务器地址后重试。'); } finally { setSaving(false); }
  };
  const leave = (action: () => void) => {
    if (!dirty) { action(); return; }
    Alert.alert('设置尚未保存', '离开后将放弃未保存的更改。', [{ text: '继续编辑', style: 'cancel' }, { text: '放弃更改', style: 'destructive', onPress: () => { const value = useSettingsStore.getState(); setDraft({ api: value.apiBaseUrl, m3u: value.m3uUrl, remote: value.remoteInputEnabled }); discard(); allowLeave.current = true; action(); } }]);
  };
  return <CinemaSettings onNavigate={page => leave(() => navigation.onNavigate(page))} onBack={() => leave(navigation.onBack)}
    apiUrl={draft.api} m3uUrl={draft.m3u} remoteEnabled={draft.remote} remoteRunning={remote.isServerRunning} remoteUrl={remote.serverUrl || undefined} remoteError={remote.error}
    loggedIn={auth.isLoggedIn} dirty={dirty} saving={saving} onSave={save} onFieldFocus={setField}
    onApiChange={value => { setDraft(previous => ({ ...previous, api: value })); edited.current = true; allowLeave.current = false; setDirty(true); }} onM3uChange={value => { setDraft(previous => ({ ...previous, m3u: value })); edited.current = true; allowLeave.current = false; setDirty(true); }} onRemoteChange={value => { setDraft(previous => ({ ...previous, remote: value })); edited.current = true; allowLeave.current = false; setDirty(true); }}
    onAccount={() => auth.isLoggedIn ? Alert.alert('退出登录', '退出当前服务器账户？', [{ text: '取消', style: 'cancel' }, { text: '退出登录', onPress: auth.logout }]) : leave(() => { navigation.onNavigate('home'); auth.showLoginModal(); })}
    updateSection={Platform.OS === 'android' ? <UpdateSection /> : undefined} />;
}
