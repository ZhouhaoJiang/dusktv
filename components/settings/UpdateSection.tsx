import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { useUpdateStore } from '@/stores/updateStore';
import { cinema as c } from '@/constants/CinemaTheme';
import { CinemaButton, useCinemaLayout } from '../cinema/CinemaUI';
export function UpdateSection() {
  const p = useUpdateStore();
  const [checking, setChecking] = useState(false);
  const { scale } = useCinemaLayout();
  return <View style={{ paddingVertical: 26 * scale, borderTopWidth: 1, borderColor: c.elevated, gap: 14 }}>
    <Text style={{ color: c.text, fontSize: 20 * scale, fontWeight: '600' }}>应用更新</Text><Text style={{ color: c.secondary, fontSize: 15 * scale }}>当前版本 v{p.currentVersion}</Text>
    {(p.error || p.downloading || p.isLatestVersion || p.updateAvailable) && <Text style={{ color: p.error ? '#F0A49B' : c.accent }}>{p.error || (p.downloading ? `下载中 ${p.downloadProgress}%` : p.updateAvailable ? `新版本 v${p.remoteVersion} 可用` : '已是最新版本')}</Text>}
    <View style={{ alignSelf: 'flex-start' }}><CinemaButton label={checking ? '正在检查…' : '检查更新'} icon={Download} disabled={checking || p.downloading} onPress={async () => { setChecking(true); try { await p.checkForUpdate(false); } finally { setChecking(false); } }} scale={scale} /></View>
  </View>;
}
