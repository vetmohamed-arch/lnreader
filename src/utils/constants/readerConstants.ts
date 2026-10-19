import { ReaderTheme } from '@hooks/persisted/useSettings';

export const presetReaderThemes: ReaderTheme[] = [
  { backgroundColor: '#f5f5fa', textColor: '#111111' },
  { backgroundColor: '#F7DFC6', textColor: '#593100' },
  { backgroundColor: '#dce5e2', textColor: '#000000' },
  { backgroundColor: '#292832', textColor: '#CCCCCC' },
  {
    backgroundColor: '#000000',
    textColor: '#FFFFFFB3',
  },
];

export interface Font {
  fontFamily: string;
  name: string;
}

export const readerFonts: Font[] = [
  { fontFamily: '', name: 'Original' },
  { fontFamily: 'lora', name: 'Lora' },
  { fontFamily: 'nunito', name: 'Nunito' },
  { fontFamily: 'noto-sans', name: 'Noto Sans' },
  { fontFamily: 'open-sans', name: 'Open Sans' },
  { fontFamily: 'arbutus-slab', name: 'Arbutus Slab' },
  { fontFamily: 'domine', name: 'Domine' },
  { fontFamily: 'lato', name: 'Lato' },
  { fontFamily: 'pt-serif', name: 'PT Serif' },
  { fontFamily: 'OpenDyslexic3-Regular', name: 'OpenDyslexic' },
  { fontFamily: 'noto-naskh-arabic', name: 'نوتو نسخ (Noto Naskh Arabic)' },
  { fontFamily: 'amiri', name: 'أميري (Amiri)' },
  { fontFamily: 'cairo', name: 'القاهرة (Cairo)' },
  { fontFamily: 'tajawal', name: 'تجوّل (Tajawal)' },
];
