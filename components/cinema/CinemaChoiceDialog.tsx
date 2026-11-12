import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { cinema as c } from '@/constants/CinemaTheme';
import { CinemaButton, CinemaDialog, useCinemaLayout } from './CinemaUI';
export interface Choice { value: string; label: string }
export default function CinemaChoiceDialog({ visible, title, options, selected, onSelect, onClose }: { visible: boolean; title: string; options: Choice[]; selected: string; onSelect: (value: string) => void; onClose: () => void }) {
  const { scale } = useCinemaLayout();
  const [page, setPage] = useState(0);
  const selectedIndex = options.findIndex(option => option.value === selected);
  useEffect(() => { if (visible) setPage(Math.max(0, Math.floor(selectedIndex / 30))); }, [visible, selectedIndex]);
  return <CinemaDialog visible={visible} title={title} onClose={onClose} wide>
    {options.length > 30 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Array.from({ length: Math.ceil(options.length / 30) }, (_, index) => <CinemaButton key={index} label={`${index * 30 + 1}–${Math.min((index + 1) * 30, options.length)}`} selected={page === index} onPress={() => setPage(index)} scale={scale * 0.9} />)}</View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{options.slice(page * 30, (page + 1) * 30).map(option => <CinemaButton key={option.value} label={option.label} selected={selected === option.value} preferred={selected === option.value} onPress={() => onSelect(option.value)} scale={scale} />)}</View>
    {!options.length && <Text style={{ color: c.secondary, paddingVertical: 20 }}>暂无可选内容。</Text>}
  </CinemaDialog>;
}
