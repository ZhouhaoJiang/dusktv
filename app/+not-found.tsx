import React from 'react';
import { CinemaButton, CinemaShell, CinemaState } from '@/components/cinema/CinemaUI';
import { useCinemaNavigation } from '@/hooks/useCinemaNavigation';
export default function NotFoundScreen() {
  const navigation = useCinemaNavigation();
  return <CinemaShell {...navigation}><CinemaState title="这个页面暂时找不到" message="回到首页，继续浏览影片。" action={<CinemaButton label="回到首页" primary onPress={() => navigation.onNavigate('home')} />} /></CinemaShell>;
}
