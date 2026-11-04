/**
 * CHO → sector workers: compose an NHM work message (speak or type), choose who gets it, how urgent
 * and by when; see how many workers have read / completed each message; withdraw (soft-delete).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Megaphone, Send, Eye, CircleCheck, Undo2, AlertTriangle, CalendarClock } from 'lucide-react-native';
import { BroadcastApi, BroadcastAudience, BroadcastPriority, SentBroadcast } from '../api/broadcastApi';
import { Card, Button, Field, Segmented, Chips, Sheet, StatusPill, SectionTitle, color, space, text, useTr } from '../ui';

const isoInDays = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const formatDue = (iso?: string | null) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : null;
};

type DueChoice = 'none' | '0' | '3' | '7';

export const ChoBroadcastPanel: React.FC = () => {
  const tr = useTr();
  const [sent, setSent] = useState<SentBroadcast[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<BroadcastPriority>('NORMAL');
  const [audience, setAudience] = useState<BroadcastAudience>('ASHA');
  const [due, setDue] = useState<DueChoice>('3');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<SentBroadcast | null>(null);

  const load = useCallback(async () => {
    try {
      setSent(await BroadcastApi.sent());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setTitle('');
    setMessage('');
    setPriority('NORMAL');
    setAudience('ASHA');
    setDue('3');
    setStatus(null);
  };

  const errorText = (code?: string) =>
    code === 'OFFLINE'
      ? tr('नेटवर्क नहीं है — संदेश भेजने के लिए इंटरनेट चाहिए', 'नेटवर्क नाही — संदेश पाठवण्यासाठी इंटरनेट लागेल', 'No network — internet needed to send messages')
      : code === 'NO_SECTOR'
      ? tr('आपके सेक्टर में अभी कोई कार्यकर्ता नहीं है', 'तुमच्या सेक्टरमध्ये अद्याप कार्यकर्ता नाही', 'No workers in your sector yet')
      : code === 'TOO_LONG'
      ? tr('संदेश बहुत लंबा है', 'संदेश खूप मोठा आहे', 'Message is too long')
      : tr('संदेश नहीं भेजा जा सका', 'संदेश पाठवता आला नाही', 'Message could not be sent');

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setStatus({ type: 'error', text: tr('विषय और संदेश भरें', 'विषय व संदेश भरा', 'Fill subject and message') });
      return;
    }
    setSending(true);
    setStatus(null);
    const res = await BroadcastApi.send({
      title: title.trim(),
      message: message.trim(),
      priority,
      audience,
      dueDate: due === 'none' ? null : isoInDays(Number(due)),
    });
    setSending(false);
    if (res.ok) {
      setStatus({ type: 'success', text: tr('संदेश भेज दिया गया', 'संदेश पाठवला', 'Message sent') });
      load();
      setTimeout(() => {
        setComposeOpen(false);
        reset();
      }, 1200);
    } else {
      setStatus({ type: 'error', text: errorText(res.error) });
    }
  };

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return;
    const ok = await BroadcastApi.withdraw(withdrawTarget.id);
    setWithdrawTarget(null);
    if (ok) load();
  };

  const audienceLabel = (a: BroadcastAudience) =>
    a === 'ASHA' ? tr('सभी आशा', 'सर्व आशा', 'All ASHAs') : a === 'ANM' ? tr('सभी एएनएम', 'सर्व एएनएम', 'All ANMs') : tr('सभी कार्यकर्ता', 'सर्व कार्यकर्ते', 'All workers');

  return (
    <View style={styles.wrap}>
      <SectionTitle label={tr('NHM संदेश', 'NHM संदेश', 'NHM message')} count={sent.length} />
      <Button
        label={tr('कार्यकर्ताओं को संदेश भेजें', 'कार्यकर्त्यांना संदेश पाठवा', 'Send message to workers')}
        icon={Megaphone}
        variant="secondary"
        onPress={() => {
          reset();
          setComposeOpen(true);
        }}
      />

      {loadFailed ? (
        <Text style={text.caption}>{tr('भेजे गए संदेश अभी लोड नहीं हुए', 'पाठवलेले संदेश लोड झाले नाहीत', 'Sent messages not loaded yet')}</Text>
      ) : null}

      {sent.slice(0, 5).map((b) => (
        <Card key={b.id} tone={b.priority === 'URGENT' ? 'red' : undefined}>
          <View style={styles.head}>
            <Text style={[text.heading, styles.flex]} numberOfLines={2}>
              {b.title}
            </Text>
            {b.priority === 'URGENT' ? <StatusPill tone="red" icon={AlertTriangle} label={tr('तत्काल', 'तातडीचे', 'Urgent')} /> : null}
          </View>
          <Text style={text.caption}>
            {audienceLabel(b.audience)}
            {formatDue(b.dueDate) ? ` · ${tr('अंतिम तिथि', 'अंतिम तारीख', 'Due date')} ${formatDue(b.dueDate)}` : ''}
          </Text>
          <Text style={[text.body, styles.message]} numberOfLines={3}>
            {b.message}
          </Text>
          <View style={styles.statsRow}>
            <StatusPill tone="neutral" icon={Eye} label={`${b.readCount} ${tr('ने पढ़ा', 'वाचले', 'read')}`} />
            <StatusPill tone="green" icon={CircleCheck} label={`${b.doneCount} ${tr('ने पूरा किया', 'पूर्ण केले', 'completed')}`} />
            <View style={styles.flex} />
            <Button label={tr('वापस लें', 'मागे घ्या', 'Withdraw')} icon={Undo2} variant="ghost" onPress={() => setWithdrawTarget(b)} />
          </View>
        </Card>
      ))}

      {/* Compose */}
      <Sheet visible={composeOpen} onClose={() => setComposeOpen(false)} title={tr('नया संदेश', 'नवीन संदेश', 'New message')} closeLabel={tr('बंद करें', 'बंद करा', 'Close')}>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {status ? (
            <Card tone={status.type === 'success' ? 'green' : 'red'}>
              <Text style={[text.body, { color: status.type === 'success' ? color.greenText : color.redText }]}>{status.text}</Text>
            </Card>
          ) : null}
          <Field label={tr('विषय', 'विषय', 'Subject')} value={title} onChangeText={setTitle} maxLength={120} voice="text" placeholder={tr('जैसे: पल्स पोलियो रविवार', 'उदा. पल्स पोलिओ रविवार', 'e.g. Pulse Polio Sunday')} />
          <Field
            label={tr('संदेश — क्या करना है', 'संदेश — काय करायचे', 'Message — what to do')}
            value={message}
            onChangeText={setMessage}
            maxLength={2000}
            multiline
            voice="long"
            helper={tr('बोलकर लिखें; दोबारा बोलने पर आगे जुड़ेगा', 'बोलून लिहा; पुन्हा बोलल्यास पुढे जोडले जाईल', 'Dictate by voice; speaking again appends')}
          />
          <Text style={text.label}>{tr('किसे भेजें', 'कोणाला पाठवायचे', 'Send to')}</Text>
          <Segmented
            value={audience}
            onChange={setAudience}
            options={[
              { key: 'ASHA', label: tr('आशा', 'आशा', 'ASHA') },
              { key: 'ANM', label: tr('एएनएम', 'एएनएम', 'ANM') },
              { key: 'ALL', label: tr('सभी', 'सर्व', 'All') },
            ]}
          />
          <Text style={text.label}>{tr('प्राथमिकता', 'प्राधान्य', 'Priority')}</Text>
          <Chips
            value={priority}
            onChange={setPriority}
            options={[
              { key: 'NORMAL', label: tr('सामान्य', 'सामान्य', 'Normal'), tone: 'accent' },
              { key: 'URGENT', label: tr('तत्काल', 'तातडीचे', 'Urgent'), tone: 'red' },
            ]}
          />
          <View style={styles.dueLabel}>
            <CalendarClock size={18} color={color.muted} strokeWidth={2} />
            <Text style={text.label}>{tr('कब तक', 'केव्हापर्यंत', 'Due by')}</Text>
          </View>
          <Chips
            value={due}
            onChange={(v: DueChoice) => setDue(v)}
            options={[
              { key: '0', label: tr('आज', 'आज', 'Today') },
              { key: '3', label: tr('3 दिन', '3 दिवस', '3 days') },
              { key: '7', label: tr('7 दिन', '7 दिवस', '7 days') },
              { key: 'none', label: tr('कोई तिथि नहीं', 'तारीख नाही', 'No date') },
            ]}
          />
          <Button label={tr('भेजें', 'पाठवा', 'Send')} icon={Send} loading={sending} onPress={handleSend} />
        </ScrollView>
      </Sheet>

      {/* Withdraw confirmation (soft-delete on the server) */}
      <Sheet visible={!!withdrawTarget} onClose={() => setWithdrawTarget(null)} title={tr('संदेश वापस लें?', 'संदेश मागे घ्यायचा?', 'Withdraw message?')} closeLabel={tr('बंद करें', 'बंद करा', 'Close')}>
        <View style={styles.sheetBody}>
          <Text style={text.body}>{withdrawTarget?.title}</Text>
          <Text style={text.caption}>{tr('कार्यकर्ताओं के फ़ोन से यह संदेश हट जाएगा।', 'कार्यकर्त्यांच्या फोनवरून हा संदेश काढला जाईल.', 'This message will be removed from workers\' phones.')}</Text>
          <Button label={tr('हाँ, वापस लें', 'होय, मागे घ्या', 'Yes, withdraw')} icon={Undo2} variant="danger" onPress={confirmWithdraw} />
          <Button label={tr('रद्द करें', 'रद्द करा', 'Cancel')} variant="secondary" onPress={() => setWithdrawTarget(null)} />
        </View>
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  message: { marginTop: space.sm },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
  sheetBody: { gap: space.md, paddingBottom: space.xl },
  dueLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
