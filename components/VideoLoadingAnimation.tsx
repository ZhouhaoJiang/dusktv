import React from 'react';
import { View } from 'react-native';
import { CinemaState } from './cinema/CinemaUI';
import { cinema } from '@/constants/CinemaTheme';
export default function VideoLoadingAnimation({ showProgressBar = true }: { showProgressBar?: boolean }) {
  return <View style={{ flex: 1, backgroundColor: cinema.background, justifyContent: 'center' }}><CinemaState loading title={showProgressBar ? '正在准备播放' : '正在加载影片'} message="请稍候…" /></View>;
}
