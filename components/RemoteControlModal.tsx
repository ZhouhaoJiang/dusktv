import React from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRemoteControlStore } from '@/stores/remoteControlStore';
import { cinema as c } from '@/constants/CinemaTheme';
import { CinemaDialog, useCinemaLayout } from './cinema/CinemaUI';
export const RemoteControlModal = () => {
  const { isModalVisible, hideModal, serverUrl, error } = useRemoteControlStore();
  const { scale } = useCinemaLayout();
  return <CinemaDialog visible={isModalVisible} title="用手机输入" onClose={hideModal}>
    <Text style={{ color: c.secondary, fontSize: 15 * scale, lineHeight: 24 * scale }}>手机和电视连接同一网络后，扫码打开遥控页面。</Text>
    {serverUrl ? <><View style={{ padding: 18, backgroundColor: '#fff', borderRadius: 18, alignSelf: 'center', marginVertical: 10 }}><QRCode value={serverUrl} size={190} backgroundColor="#fff" color="#101214" /></View><Text selectable style={{ color: c.secondary, fontSize: 14 * scale, textAlign: 'center' }}>{serverUrl}</Text></> : <Text style={{ color: error ? '#F0A49B' : c.secondary, textAlign: 'center', paddingVertical: 36 }}>{error || '正在准备遥控连接…'}</Text>}
  </CinemaDialog>;
};
