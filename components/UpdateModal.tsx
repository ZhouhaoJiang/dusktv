import React from 'react';
import CinemaUpdate from './cinema/CinemaUpdate';
import { useUpdateStore } from '@/stores/updateStore';
export function UpdateModal() {
  const p = useUpdateStore();
  return <CinemaUpdate visible={p.showUpdateModal} current={p.currentVersion} latest={p.remoteVersion || ''} downloading={p.downloading} downloaded={!!p.downloadedPath} progress={p.downloadProgress} error={p.error}
    onClose={() => p.setShowUpdateModal(false)} onSkip={p.skipThisVersion} onAction={() => { if (p.downloading) return; if (p.downloadedPath) p.installUpdate(); else p.startDownload(); }} />;
}
