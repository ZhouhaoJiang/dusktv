import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { LockKeyhole, UserRound } from 'lucide-react-native';
import { cinema as c } from '@/constants/CinemaTheme';
import { CinemaButton, CinemaDialog, CinemaField, useCinemaLayout } from './CinemaUI';
export default function CinemaLogin(p: { visible: boolean; username: string; password: string; needsUsername: boolean; loading: boolean; error?: string; onUsername: (value: string) => void; onPassword: (value: string) => void; onLogin: () => void; onClose: () => void; usernameRef?: React.Ref<TextInput>; passwordRef?: React.RefObject<TextInput> }) {
  const { scale } = useCinemaLayout();
  return <CinemaDialog visible={p.visible} title="登录影视库" onClose={p.onClose}>
    <Text style={{ color: c.secondary, fontSize: 15 * scale, lineHeight: 24 * scale, marginBottom: 6 }}>使用你的服务器账户，继续观看和同步收藏。</Text>
    {p.needsUsername && <CinemaField ref={p.usernameRef} label="用户名" leadingIcon={UserRound} placeholder="输入用户名" value={p.username} onChangeText={p.onUsername} autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => p.passwordRef?.current?.focus()} />}
    <CinemaField ref={p.passwordRef} label="密码" leadingIcon={LockKeyhole} placeholder="输入密码" secureTextEntry value={p.password} onChangeText={p.onPassword} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={p.onLogin} />
    {!!p.error && <Text accessibilityLiveRegion="polite" style={{ color: '#F0A49B', fontSize: 14 * scale, lineHeight: 22 * scale }}>{p.error}</Text>}
    <View style={{ marginTop: 8 }}><CinemaButton label={p.loading ? '正在登录…' : '登录'} primary disabled={p.loading || !p.password || (p.needsUsername && !p.username.trim())} onPress={p.onLogin} scale={scale} /></View>
  </CinemaDialog>;
}
