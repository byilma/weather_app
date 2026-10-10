// "Share today": a square card of the day's verdict, previewed first, then sent
// to the phone's share sheet as an image.

import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { DayVibe } from './vibe';
import { F, INK } from './theme';

// TODO: once Skyscore is in the stores, put the download link here (e.g. your site's
// short URL that redirects to the right store). It prints on every shared card, so each
// share carries a way to get the app. Images can't carry tappable links reliably on
// every platform, so a short, readable URL is the dependable option.
const APP_LINK = '';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onShared?: () => void;
  place: string;
  day: DayVibe;
  colors: [string, string, string];
};

export function ShareCard({ visible, onClose, onShared, place, day, colors }: Props) {
  const { width } = useWindowDimensions();
  const side = Math.min(width - 48, 380);
  const card = useRef<View>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const d = day.date;
  const date = `${DAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
  const scoreSize = side * 0.44;

  const share = async () => {
    setStatus('working');
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, width: 1080, height: 1080, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share today' });
      onShared?.();
      setStatus('idle');
      onClose();
    } catch {
      setStatus('error');
    }
  };

  const close = () => {
    setStatus('idle');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close">
        {/* Inner Pressable swallows taps so tapping the card doesn't close it. */}
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View ref={card} collapsable={false} style={[styles.card, { width: side, height: side }]}>
            <LinearGradient colors={colors} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.cardTop}>
              <Text style={styles.cardPlace} numberOfLines={1}>{place}</Text>
              <Text style={styles.cardDate}>{date}</Text>
            </View>

            <View style={styles.cardMiddle}>
              <View>
                <Text style={[styles.cardScore, { fontSize: scoreSize, lineHeight: scoreSize * 1.02 }]}>{day.score}</Text>
                <Text style={[styles.cardOutOf, { fontSize: scoreSize * 0.2, bottom: scoreSize * 0.1 }]}>/10</Text>
              </View>
              <Text style={styles.cardWord}>{day.word}</Text>
              <Text style={styles.cardVibe}>{day.feeling}</Text>
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.wordmark}>Skyscore</Text>
              {!!APP_LINK && <Text style={styles.appLink}>{APP_LINK}</Text>}
            </View>
          </View>

          <Pressable
            style={[styles.shareButton, status === 'working' && styles.dim]}
            onPress={share}
            disabled={status === 'working'}
            accessibilityRole="button"
          >
            <Text style={styles.shareText}>{status === 'working' ? 'Preparing…' : 'Share'}</Text>
          </Pressable>
          {status === 'error' && <Text style={styles.error}>Couldn't open sharing. Try again.</Text>}
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
            <Text style={styles.cancel}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,16,0.72)', alignItems: 'center', justifyContent: 'center' },
  sheet: { alignItems: 'center' },
  card: { borderRadius: 28, overflow: 'hidden', padding: 22, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardPlace: { color: INK.full, fontFamily: F.semi, fontSize: 15, flexShrink: 1 },
  cardDate: { color: INK.strong, fontFamily: F.text, fontSize: 15 },
  cardMiddle: { alignItems: 'center' },
  cardScore: { color: INK.full, fontFamily: F.score, textAlign: 'center' },
  cardOutOf: { color: INK.soft, fontFamily: F.scoreB, position: 'absolute', left: '100%', marginLeft: 3 },
  cardWord: { color: INK.full, fontFamily: F.scoreXB, fontSize: 40, lineHeight: 44, marginTop: -4 },
  cardVibe: { color: INK.full, fontFamily: F.italic, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: '88%' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  wordmark: { color: INK.strong, fontFamily: F.scoreB, fontSize: 18, letterSpacing: 0.5 },
  appLink: { color: INK.strong, fontFamily: F.semi, fontSize: 13 },
  shareButton: { marginTop: 22, backgroundColor: INK.full, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 44 },
  dim: { opacity: 0.6 },
  shareText: { color: INK.onWhite, fontFamily: F.bold, fontSize: 17 },
  error: { color: INK.full, fontFamily: F.text, fontSize: 14, marginTop: 10 },
  cancel: { color: INK.strong, fontFamily: F.semi, fontSize: 16, marginTop: 16 },
});
