/**
 * NHM संदेश — work broadcasts from the CHO / NHM, shown on the worker's Today screen.
 * Urgent first; "सुनें" reads the message aloud (offline TTS) and marks it read;
 * "काम पूरा" marks it done (queued when offline). Renders nothing when there are no messages.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Megaphone, Volume2, Square, CircleCheck, CalendarClock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react-native';
import { BroadcastApi, Broadcast } from '../api/broadcastApi';
import { SpeechEngine } from '../voice/speechEngine';
import { useLanguage } from '../context/LanguageContext';
import { Card, Button, StatusPill, SectionTitle, color, space, text, useTr } from '../ui';

const formatDue = (iso?: string | null) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : null;
};

const isOverdue = (iso?: string | null) => {
  if (!iso) return false;
  const due = new Date(`${String(iso).slice(0, 10)}T23:59:59`);
  return !isNaN(due.getTime()) && due.getTime() < Date.now();
};

export const BroadcastInbox: React.FC<{ refreshKey?: unknown }> = ({ refreshKey }) => {
  const tr = useTr();
  const { language } = useLanguage();
  const locale = language === 'mr' ? 'mr-IN' : language === 'en' ? 'en-IN' : 'hi-IN';
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const speakToken = useRef(0);

  const load = useCallback(async () => {
    setRows(await BroadcastApi.cachedInbox());
    const { rows: fresh } = await BroadcastApi.refreshInbox();
    setRows(fresh);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => () => SpeechEngine.stop(), []);

  const markLocal = (id: number, done: boolean) => {
    const now = new Date().toISOString();
    setRows((prev) => prev.map((b) => (b.id === id ? { ...b, readAt: b.readAt || now, doneAt: done ? b.doneAt || now : b.doneAt } : b)));
  };

  const sender = (b: Broadcast) =>
    b.senderRole === 'ADMIN'
      ? tr('राष्ट्रीय स्वास्थ्य मिशन', 'राष्ट्रीय आरोग्य अभियान', 'National Health Mission')
      : `${tr('सीएचओ', 'सीएचओ', 'CHO')}${b.senderName ? ` · ${b.senderName}` : ''}`;

  const listen = (b: Broadcast) => {
    if (speakingId === b.id) {
      speakToken.current++;
      SpeechEngine.stop();
      setSpeakingId(null);
      return;
    }
    SpeechEngine.stop();
    const token = ++speakToken.current;
    setSpeakingId(b.id);
    const due = formatDue(b.dueDate);
    const spoken = [
      `${sender(b)} ${tr('का संदेश', 'यांचा संदेश', 'message')}.`,
      b.title + '.',
      b.message,
      due ? `${tr('अंतिम तिथि', 'अंतिम तारीख', 'Due date')} ${due}.` : '',
    ].join(' ');
    SpeechEngine.speak(spoken, locale, 0.9, undefined, () => {
      if (speakToken.current === token) setSpeakingId(null);
    }).catch(() => setSpeakingId(null));
    if (!b.readAt) {
      markLocal(b.id, false);
      BroadcastApi.acknowledge(b.id, false).catch(() => {});
    }
  };

  const toggleExpanded = (b: Broadcast) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(b.id)) next.delete(b.id);
      else next.add(b.id);
      return next;
    });
    if (!b.readAt) {
      markLocal(b.id, false);
      BroadcastApi.acknowledge(b.id, false).catch(() => {});
    }
  };

  const markDone = (b: Broadcast) => {
    if (speakingId === b.id) {
      SpeechEngine.stop();
      setSpeakingId(null);
    }
    markLocal(b.id, true);
    BroadcastApi.acknowledge(b.id, true).catch(() => {});
  };

  if (rows.length === 0) return null;

  const open = rows.filter((b) => !b.doneAt);
  const done = rows.filter((b) => b.doneAt);
  const unread = open.filter((b) => !b.readAt).length;

  const renderCard = (b: Broadcast) => {
    const urgent = b.priority === 'URGENT';
    const due = formatDue(b.dueDate);
    const overdue = !b.doneAt && isOverdue(b.dueDate);
    const isOpen = expanded.has(b.id);
    const speaking = speakingId === b.id;
    return (
      <Card key={b.id} tone={b.doneAt ? 'green' : urgent ? 'red' : undefined}>
        <Pressable
          onPress={() => toggleExpanded(b)}
          accessibilityRole="button"
          accessibilityLabel={b.title}
          accessibilityState={{ expanded: isOpen }}
        >
          <View style={styles.head}>
            {!b.readAt ? <View style={styles.unreadDot} accessibilityLabel={tr('नया', 'नवीन', 'New')} /> : null}
            <Text style={[text.heading, styles.flex]} numberOfLines={isOpen ? undefined : 2}>
              {b.title}
            </Text>
            {urgent && !b.doneAt ? <StatusPill tone="red" icon={AlertTriangle} label={tr('तत्काल', 'तातडीचे', 'Urgent')} /> : null}
            {b.doneAt ? <StatusPill tone="green" icon={CircleCheck} label={tr('पूरा', 'पूर्ण', 'Done')} /> : null}
          </View>
          <Text style={text.caption}>{sender(b)}</Text>
          <Text style={[text.body, styles.message]} numberOfLines={isOpen ? undefined : 3}>
            {b.message}
          </Text>
          {due ? (
            <View style={styles.dueRow}>
              <CalendarClock size={16} color={overdue ? color.red : color.muted} strokeWidth={2} />
              <Text style={[text.caption, overdue && { color: color.redText, fontWeight: '700' }]}>
                {overdue ? tr('समय निकल गया', 'मुदत संपली', 'Time over') : tr('अंतिम तिथि', 'अंतिम तारीख', 'Due date')} · {due}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              label={speaking ? tr('रोकें', 'थांबवा', 'Stop') : tr('सुनें', 'ऐका', 'Listen')}
              icon={speaking ? Square : Volume2}
              variant={speaking ? 'danger' : 'secondary'}
              onPress={() => listen(b)}
            />
          </View>
          {!b.doneAt ? (
            <View style={styles.flex}>
              <Button label={tr('काम पूरा', 'काम पूर्ण', 'Work done')} icon={CircleCheck} onPress={() => markDone(b)} />
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Megaphone size={20} color={color.accent} strokeWidth={2} />
        <View style={styles.flex}>
          <SectionTitle label={tr('NHM संदेश', 'NHM संदेश', 'NHM message')} count={open.length} />
        </View>
        {unread > 0 ? <StatusPill tone="accent" label={`${unread} ${tr('नए', 'नवीन', 'New')}`} /> : null}
      </View>

      {open.map(renderCard)}

      {done.length > 0 ? (
        <Pressable
          onPress={() => setShowDone((v) => !v)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneToggle, pressed && { opacity: 0.7 }]}
        >
          <Text style={[text.label, { color: color.muted }]}>
            {tr('पूरे हुए', 'पूर्ण झालेले', 'Completed')} ({done.length})
          </Text>
          {showDone ? (
            <ChevronUp size={18} color={color.muted} strokeWidth={2} />
          ) : (
            <ChevronDown size={18} color={color.muted} strokeWidth={2} />
          )}
        </Pressable>
      ) : null}
      {showDone ? done.map(renderCard) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.accent },
  message: { marginTop: space.sm },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 48 },
});
