// Full-screen city picker. "Current location" is always the first row.

import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { placeKey, searchCities, type Place } from './places';
import { F, INK } from './theme';

export type CityRow = { place: Place; score?: number; word?: string };

type Props = {
  visible: boolean;
  background: string;
  onClose: () => void;
  onPick: (place: Place | 'current') => void;
  current?: CityRow; // where the phone is, if location is on
  saved: CityRow[]; // the user's cities, in order
  onRemove: (place: Place) => void;
};

export function CitySearch({ visible, background, onClose, onPick, current, saved, onRemove }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'none' | 'error'>('idle');
  const latest = useRef(0);

  // Search as you type, with a short pause so we don't fire on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      latest.current++; // drop any search still in flight
      setResults([]);
      setStatus('idle');
      return;
    }
    setStatus('searching');
    const id = ++latest.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchCities(q);
        if (id !== latest.current) return; // a newer search is running
        setResults(found);
        setStatus(found.length ? 'idle' : 'none');
      } catch {
        if (id === latest.current) setStatus('error');
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (p: Place | 'current') => {
    setQuery('');
    onPick(p);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.fill, { backgroundColor: background }]}>
        <View style={styles.bar}>
          <View style={styles.field}>
            <Ionicons name="search" size={18} color={INK.soft} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search a city"
              placeholderTextColor={INK.soft}
              selectionColor="#fff"
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <FlatList
          data={results}
          keyExtractor={(p) => `${p.lat},${p.lon}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            query.trim().length >= 2 ? null : (
              <View>
                <Pressable style={styles.row} onPress={() => pick('current')} accessibilityRole="button">
                  <Ionicons name="navigate" size={16} color={INK.full} />
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{current ? current.place.name : 'Current location'}</Text>
                    {current && <Text style={styles.detail}>Where you are</Text>}
                  </View>
                  {current?.score != null && <Score value={current.score} word={current.word} />}
                </Pressable>
                {saved.length > 0 && <Text style={styles.section}>Your cities</Text>}
                {saved.map((c) => (
                  <View key={placeKey(c.place)} style={styles.row}>
                    <Pressable style={styles.rowMain} onPress={() => pick(c.place)} accessibilityRole="button">
                      <View style={styles.rowText}>
                        <Text style={styles.name}>{c.place.name}</Text>
                        {!!c.place.detail && <Text style={styles.detail}>{c.place.detail}</Text>}
                      </View>
                      {c.score != null && <Score value={c.score} word={c.word} />}
                    </Pressable>
                    <Pressable
                      onPress={() => onRemove(c.place)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${c.place.name}`}
                    >
                      <Ionicons name="close" size={18} color={INK.strong} />
                    </Pressable>
                  </View>
                ))}
                {saved.length === 0 && (
                  <Text style={styles.hint}>Search a city to save it. Then swipe left and right to flip between your cities.</Text>
                )}
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => pick(item)} accessibilityRole="button">
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.detail && <Text style={styles.detail}>{item.detail}</Text>}
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            status === 'idle' ? null : (
              <Text style={styles.status}>
                {status === 'searching'
                  ? 'Searching…'
                  : status === 'none'
                    ? 'No city by that name. Check the spelling.'
                    : "Can't search right now. Check your connection."}
              </Text>
            )
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

// Today's score for a city, small, in the score typeface.
function Score({ value, word }: { value: number; word?: string }) {
  return (
    <View style={styles.score}>
      <Text style={styles.scoreNum}>{value}</Text>
      {!!word && <Text style={styles.scoreWord} numberOfLines={1}>{word}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: INK.shade, borderRadius: 14, paddingHorizontal: 14,
  },
  input: { flex: 1, color: INK.full, fontFamily: F.text, fontSize: 18, paddingVertical: 12 },
  cancel: { color: INK.full, fontFamily: F.semi, fontSize: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  rowText: { flex: 1 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  section: { color: INK.strong, fontFamily: F.semi, fontSize: 14, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 4 },
  hint: { color: INK.strong, fontFamily: F.text, fontSize: 15, lineHeight: 21, paddingHorizontal: 22, paddingTop: 18 },
  score: { alignItems: 'center', minWidth: 56 },
  scoreNum: { color: INK.full, fontFamily: F.scoreXB, fontSize: 28, lineHeight: 30 },
  scoreWord: { color: INK.strong, fontFamily: F.text, fontSize: 11 },
  name: { color: INK.full, fontFamily: F.semi, fontSize: 18 },
  detail: { color: INK.strong, fontFamily: F.text, fontSize: 14, marginTop: 2 },
  status: { color: INK.strong, fontFamily: F.text, fontSize: 15, paddingHorizontal: 22, paddingTop: 16 },
});
