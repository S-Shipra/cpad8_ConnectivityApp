import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Vibration,
  Animated,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Feature 3 (+ enhancement: cellular generation, e.g. "Cellular (4G)")
const typeLabel = (net) => {
  if (!net.isConnected) return 'No Connection';
  switch (net.type) {
    case 'wifi':
      return 'Wi-Fi';
    case 'cellular': {
      const gen = net.details && net.details.cellularGeneration;
      return gen ? `Cellular (${gen.toUpperCase()})` : 'Cellular';
    }
    case 'ethernet':
      return 'Ethernet';
    default:
      return net.type.charAt(0).toUpperCase() + net.type.slice(1);
  }
};

// Feature 4: reachability can be true, false, or null (still checking)
const reachableLabel = (value) => {
  if (value === null || value === undefined) return 'Checking...';
  return value ? 'Yes' : 'No';
};

const timeNow = () => new Date().toLocaleTimeString();

const show = (value, suffix = '') =>
  value === null || value === undefined || value === '' ? 'Not available' : `${value}${suffix}`;

const themes = {
  light: {
    bg: '#f5f6fa',
    card: '#ffffff',
    text: '#2c3e50',
    muted: '#7f8c8d',
    border: '#e1e5ea',
    input: '#ffffff',
  },
  dark: {
    bg: '#12161c',
    card: '#1c222b',
    text: '#ecf0f1',
    muted: '#95a5a6',
    border: '#2d3641',
    input: '#242c37',
  },
};

const QUOTE_URL = 'https://dummyjson.com/quotes/random';
const PING_URL = 'https://clients3.google.com/generate_204';

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  // Enhancement: dark mode
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? themes.dark : themes.light;

  // Feature 7: state for type, connected flag, reachable flag (+ details)
  const [net, setNet] = useState({
    type: 'unknown',
    isConnected: false,
    isInternetReachable: null,
    details: null,
  });

  // Enhancement: last updated time + connection history
  const [lastChecked, setLastChecked] = useState(null);
  const [history, setHistory] = useState([]);

  // Enhancement: latency test
  const [ping, setPing] = useState({ status: 'idle', ms: null });

  // Enhancement: offline message queue
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  // Enhancement: cached data
  const [quote, setQuote] = useState(null); // { text, author, source: 'live' | 'cached', savedAt }

  const pulse = useRef(new Animated.Value(1)).current;
  const previousConnected = useRef(null);
  const previousKey = useRef(null);

  // "Online" for app logic = connected AND not known to be unreachable
  const online = net.isConnected && net.isInternetReachable !== false;

  /* ---------------- Core connectivity logic (features 6-9, 11) ---------------- */

  const updateState = useCallback((state) => {
    const next = {
      type: state.type,
      isConnected: !!state.isConnected,
      isInternetReachable: state.isInternetReachable,
      details: state.details || null,
    };
    setNet(next);
    setLastChecked(timeNow());

    // Enhancement: add a history entry only when the connection actually changes
    const key = `${next.isConnected}-${next.type}`;
    if (previousKey.current !== key) {
      previousKey.current = key;
      const label = typeLabel(next);
      setHistory((h) => [{ id: Date.now().toString(), time: timeNow(), label }, ...h].slice(0, 10));
    }
  }, []);

  useEffect(() => {
    // Feature 6: read the initial state on load
    NetInfo.fetch().then(updateState);

    // Feature 8: subscribe to live changes
    const unsubscribe = NetInfo.addEventListener(updateState);

    // Feature 9: clean up when the screen closes
    return () => unsubscribe();
  }, [updateState]);

  // Feature 12 (optional): vibrate + pulse when online/offline flips
  useEffect(() => {
    if (previousConnected.current !== null && previousConnected.current !== net.isConnected) {
      Vibration.vibrate(300);
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    previousConnected.current = net.isConnected;
  }, [net.isConnected, pulse]);

  /* ---------------- Enhancement: latency test ---------------- */

  const runPing = useCallback(async () => {
    setPing({ status: 'testing', ms: null });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const start = Date.now();
    try {
      await fetch(PING_URL, { signal: controller.signal, cache: 'no-store' });
      setPing({ status: 'ok', ms: Date.now() - start });
    } catch (e) {
      setPing({ status: 'fail', ms: null });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // Feature 11: manual refresh, independent of the listener
  const handleRefresh = () => {
    NetInfo.fetch().then(updateState);
    runPing();
  };

  /* ---------------- Enhancement: cached quote ---------------- */

  const loadQuote = useCallback(async () => {
    try {
      const res = await fetch(QUOTE_URL);
      const data = await res.json();
      const fresh = {
        text: data.quote,
        author: data.author,
        source: 'live',
        savedAt: timeNow(),
      };
      setQuote(fresh);
      await AsyncStorage.setItem('cachedQuote', JSON.stringify(fresh));
    } catch (e) {
      // Network failed: fall back to whatever we saved earlier
      try {
        const saved = await AsyncStorage.getItem('cachedQuote');
        if (saved) setQuote({ ...JSON.parse(saved), source: 'cached' });
      } catch (err) {
        // nothing cached yet
      }
    }
  }, []);

  // On launch, show the cached copy immediately
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('cachedQuote');
        if (saved) setQuote({ ...JSON.parse(saved), source: 'cached' });
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Fetch a fresh quote whenever the device (re)gains internet
  useEffect(() => {
    if (online) loadQuote();
  }, [online, loadQuote]);

  /* ---------------- Enhancement: offline message queue ---------------- */

  // Load saved messages once
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('messages');
        if (saved) setMessages(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
      setMessagesLoaded(true);
    })();
  }, []);

  // Persist messages whenever they change
  useEffect(() => {
    if (!messagesLoaded) return;
    AsyncStorage.setItem('messages', JSON.stringify(messages)).catch(() => {});
  }, [messages, messagesLoaded]);

  const queuedCount = messages.filter((m) => m.status === 'queued').length;

  // Auto-sync: when we are online and have queued messages, "send" them
  useEffect(() => {
    if (online && queuedCount > 0) {
      const timer = setTimeout(() => {
        setMessages((list) =>
          list.map((m) => (m.status === 'queued' ? { ...m, status: 'sent', sentAt: timeNow() } : m))
        );
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [online, queuedCount]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    const msg = {
      id: Date.now().toString(),
      text,
      status: online ? 'sent' : 'queued',
      createdAt: timeNow(),
      sentAt: online ? timeNow() : null,
    };
    setMessages((list) => [msg, ...list].slice(0, 20));
    setDraft('');
  };

  /* ---------------- UI ---------------- */

  const wifi = net.type === 'wifi' && net.isConnected ? net.details || {} : null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Enhancement: offline banner */}
      {!net.isConnected && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You are offline. Changes will sync when you reconnect.</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: net.isConnected ? 70 : 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Feature 1: title */}
        <Text style={[styles.title, { color: t.text }]}>Connectivity Status</Text>

        {/* Features 2 and 10: indicator that changes colour with state */}
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: net.isConnected ? '#2ecc71' : '#e74c3c' },
            { transform: [{ scale: pulse }] },
          ]}
        >
          <Text style={styles.indicatorText}>{net.isConnected ? 'ONLINE' : 'OFFLINE'}</Text>
        </Animated.View>

        {/* Feature 3: connection type (now with cellular generation) */}
        <Text style={[styles.typeText, { color: t.text }]}>{typeLabel(net)}</Text>

        {/* Feature 4: internet reachability */}
        <Text style={[styles.reachText, { color: t.muted }]}>
          Internet reachable: {reachableLabel(net.isInternetReachable)}
        </Text>

        {/* Enhancement: last updated */}
        <Text style={[styles.smallText, { color: t.muted }]}>
          Last checked: {lastChecked || 'Not yet'}
        </Text>

        {/* Feature 5: refresh button */}
        <TouchableOpacity style={styles.button} onPress={handleRefresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>

        {/* Enhancement: Wi-Fi details */}
        {wifi && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Wi-Fi details</Text>
            <Row label="Network name" value={show(wifi.ssid)} t={t} />
            <Row label="IP address" value={show(wifi.ipAddress)} t={t} />
            <Row label="Signal strength" value={show(wifi.strength, '%')} t={t} />
            <Row label="Frequency" value={show(wifi.frequency, ' MHz')} t={t} />
            <Text style={[styles.note, { color: t.muted }]}>
              iOS hides some of these values. Android shows more.
            </Text>
          </View>
        )}

        {/* Enhancement: latency test */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Latency test</Text>
          <Text style={[styles.cardBody, { color: t.text }]}>
            {ping.status === 'idle' && 'Not tested yet'}
            {ping.status === 'testing' && 'Testing...'}
            {ping.status === 'ok' && `${ping.ms} ms to reach the internet`}
            {ping.status === 'fail' && 'Could not reach the internet'}
          </Text>
          <TouchableOpacity style={styles.buttonSecondary} onPress={runPing}>
            <Text style={styles.buttonSecondaryText}>Run test</Text>
          </TouchableOpacity>
        </View>

        {/* Enhancement: offline message queue */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Message queue</Text>
          <Text style={[styles.note, { color: t.muted }]}>
            {online
              ? 'Online: messages send right away.'
              : 'Offline: messages wait in the queue and send when you reconnect.'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
              placeholder="Type a message"
              placeholderTextColor={t.muted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Text style={styles.buttonText}>Send</Text>
            </TouchableOpacity>
          </View>
          {queuedCount > 0 && (
            <Text style={styles.queuedCount}>
              {queuedCount} message{queuedCount > 1 ? 's' : ''} waiting to send
            </Text>
          )}
          {messages.length === 0 && (
            <Text style={[styles.note, { color: t.muted }]}>No messages yet.</Text>
          )}
          {messages.slice(0, 6).map((m) => (
            <View key={m.id} style={[styles.messageRow, { borderColor: t.border }]}>
              <Text style={[styles.messageText, { color: t.text }]} numberOfLines={2}>
                {m.text}
              </Text>
              <Text style={[styles.badge, m.status === 'queued' ? styles.badgeQueued : styles.badgeSent]}>
                {m.status === 'queued' ? 'Queued' : 'Sent'}
              </Text>
            </View>
          ))}
        </View>

        {/* Enhancement: cached data */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Quote of the moment</Text>
          {quote ? (
            <>
              <Text style={[styles.cardBody, { color: t.text }]}>"{quote.text}"</Text>
              <Text style={[styles.note, { color: t.muted }]}>
                {quote.author} ({quote.source === 'live' ? 'live' : `cached, saved ${quote.savedAt}`})
              </Text>
            </>
          ) : (
            <Text style={[styles.note, { color: t.muted }]}>
              Nothing saved yet. Connect once to load a quote, then go offline to see the cached copy.
            </Text>
          )}
        </View>

        {/* Enhancement: connection history */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Connection history</Text>
          {history.length === 0 && (
            <Text style={[styles.note, { color: t.muted }]}>No changes yet.</Text>
          )}
          {history.map((h) => (
            <Row key={h.id} label={h.time} value={h.label} t={t} />
          ))}
        </View>
      </ScrollView>

      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </KeyboardAvoidingView>
  );
}

/* Small label/value row used in several cards */
function Row({ label, value, t }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: t.text }]}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#c0392b',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  indicator: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    elevation: 6,
  },
  indicatorText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  typeText: { fontSize: 22, fontWeight: '600', marginBottom: 6 },
  reachText: { fontSize: 16, marginBottom: 4 },
  smallText: { fontSize: 13, marginBottom: 24 },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  buttonSecondaryText: { color: '#3498db', fontSize: 15, fontWeight: '600' },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  inputRow: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3498db',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  queuedCount: { color: '#e67e22', fontSize: 13, fontWeight: '600', marginTop: 8 },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    marginTop: 8,
  },
  messageText: { flex: 1, fontSize: 14, marginRight: 8 },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badgeQueued: { backgroundColor: '#fdebd0', color: '#b9770e' },
  badgeSent: { backgroundColor: '#d5f5e3', color: '#1e8449' },
});