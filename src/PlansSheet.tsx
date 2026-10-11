// The Plans sheet: three ideas ranked for right now, more on request, and a search
// for anything else. Every option hands off to a partner app or site.

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { searchLinks, type Plan, type PlanKind, type Where } from './plans';
import { openLink, type Link, type MapsApp } from './partners';
import { F, themed, useInk, type Ink } from './theme';

const ICON: Record<PlanKind, keyof typeof Ionicons.glyphMap> = {
  ride: 'car-outline', food: 'bag-handle-outline', coffee: 'cafe-outline', movie: 'film-outline', museum: 'library-outline',
  park: 'leaf-outline', icecream: 'ice-cream-outline', brunch: 'restaurant-outline', outdoorTable: 'restaurant-outline',
  bar: 'wine-outline', tonight: 'ticket-outline', lateFood: 'fast-food-outline',
};
const SHOWN = 3; // ideas shown before "More ideas"

type Props = {
  visible: boolean;
  onClose: () => void;
  plans: Plan[];
  focus?: PlanKind; // open with this plan expanded (e.g. from the rain alert's "Get a ride")
  where: Where;
  background: string;
  onLinkTap?: (kind: PlanKind | 'search', link: Link) => void; // for counting taps
  onMapsApp?: (app: MapsApp) => void; // iPhone only: switch between Apple Maps and Google Maps
};

export function PlansSheet({ visible, onClose, plans, focus, where, background, onLinkTap, onMapsApp }: Props) {
  const city = where.city;
  const styles = useStyles();
  const INK = useInk();
  const open = (kind: PlanKind | 'search', l: Link) => {
    Haptics.selectionAsync().catch(() => {});
    onLinkTap?.(kind, l);
    openLink(l);
  };
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<PlanKind | undefined>(focus);
  const [more, setMore] = useState(false);

  // Each time the sheet opens, start fresh (and honour the focus it was opened with).
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setExpanded(focus);
    setMore(false);
  }, [visible, focus]);

  const ordered = focus ? [...plans].sort((a, b) => (a.kind === focus ? -1 : b.kind === focus ? 1 : 0)) : plans;
  const shown = more ? ordered : ordered.slice(0, SHOWN);
  const results = searchLinks(query, where);

  const tapPlan = (p: Plan) => {
    if (p.links.length === 1) return open(p.kind, p.links[0]);
    Haptics.selectionAsync().catch(() => {});
    setExpanded((k) => (k === p.kind ? undefined : p.kind));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close plans" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dock} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: background, maxHeight: height * 0.82, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>Plans</Text>
              <Text style={styles.sub} numberOfLines={1}>{city ? `in ${city}` : 'near you'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Ionicons name="search" size={18} color={INK.soft} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search anything to do"
              placeholderTextColor={INK.soft}
              selectionColor={INK.full}
              keyboardAppearance={INK.statusBar === 'dark' ? 'light' : 'dark'}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onSubmitEditing={() => results[0] && open('search', results[0].link)}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
            {query.trim()
              ? results.map((r) => (
                  <Pressable key={r.title} style={styles.row} onPress={() => open('search', r.link)} accessibilityRole="link">
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
                      <Text style={styles.rowWhy}>{r.why ?? `on ${r.link.label}`}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={INK.strong} />
                  </Pressable>
                ))
              : shown.map((p) => (
                  <View key={p.kind}>
                    <Pressable
                      style={styles.row}
                      onPress={() => tapPlan(p)}
                      accessibilityRole={p.links.length === 1 ? 'link' : 'button'}
                      accessibilityState={{ expanded: expanded === p.kind }}
                    >
                      <View style={styles.icon}>
                        <Ionicons name={ICON[p.kind]} size={20} color={INK.full} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{p.title}</Text>
                        <Text style={styles.rowWhy}>{p.why}</Text>
                      </View>
                      <Ionicons
                        name={p.links.length === 1 ? 'arrow-forward' : expanded === p.kind ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={INK.strong}
                      />
                    </Pressable>
                    {p.links.length > 1 && expanded === p.kind && (
                      <View style={styles.providers}>
                        {p.links.map((l) => (
                          <Pressable key={l.partner} style={styles.provider} onPress={() => open(p.kind, l)} accessibilityRole="link">
                            <Text style={styles.providerText}>{l.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

            {!query.trim() && !more && ordered.length > SHOWN && (
              <Pressable onPress={() => setMore(true)} hitSlop={8} style={styles.moreButton} accessibilityRole="button">
                <Text style={styles.more}>More ideas</Text>
              </Pressable>
            )}
          </ScrollView>

          {Platform.OS === 'ios' && onMapsApp && (
            <Pressable
              onPress={() => onMapsApp(where.mapsApp === 'apple' ? 'google' : 'apple')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Places open in ${where.mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps'}. Switch`}
            >
              <Text style={styles.mapsPref}>
                Places open in {where.mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps'} ·{' '}
                <Text style={styles.mapsSwitch}>Use {where.mapsApp === 'apple' ? 'Google Maps' : 'Apple Maps'}</Text>
              </Text>
            </Pressable>
          )}
          <Text style={styles.disclosure}>Some links may earn us a commission.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = themed((INK: Ink) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,8,16,0.5)' },
  dock: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: INK.faint, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  headText: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  title: { color: INK.full, fontFamily: F.scoreXB, fontSize: 36, lineHeight: 40 },
  sub: { color: INK.strong, fontFamily: F.semi, fontSize: 16, flexShrink: 1 },
  done: { color: INK.full, fontFamily: F.semi, fontSize: 16, paddingBottom: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: INK.shade,
    borderRadius: 14, paddingHorizontal: 14, marginBottom: 6,
  },
  input: { flex: 1, color: INK.full, fontFamily: F.text, fontSize: 17, paddingVertical: 12 },
  list: { paddingBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: INK.line,
  },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: INK.shade, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: INK.full, fontFamily: F.semi, fontSize: 18 },
  rowWhy: { color: INK.strong, fontFamily: F.text, fontSize: 14, marginTop: 2 },
  providers: { flexDirection: 'row', gap: 10, paddingVertical: 12, paddingLeft: 54 },
  provider: { backgroundColor: INK.full, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  providerText: { color: INK.onFull, fontFamily: F.bold, fontSize: 15 },
  moreButton: { paddingVertical: 14 },
  more: { color: INK.full, fontFamily: F.semi, fontSize: 16, textAlign: 'center' },
  disclosure: { color: INK.strong, fontFamily: F.text, fontSize: 12, textAlign: 'center', marginTop: 6 },
  mapsPref: { color: INK.strong, fontFamily: F.text, fontSize: 13, textAlign: 'center', marginTop: 8 },
  mapsSwitch: { color: INK.full, fontFamily: F.semi, textDecorationLine: 'underline' },
}));
