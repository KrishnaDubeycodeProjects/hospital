/**
 * फॉलो-अप / रेफरल — referral & follow-up tasks with R/A/G status.
 * Physical referral validation only (CHO-validated = green "सत्यापित"); no teleconsultation.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Phone, Check, Route, CircleCheck, ShieldCheck, Pill, Clock, Activity } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { FollowUpTask } from '../types/storage';
import { AppBar, Screen, Card, IconBadge, StatusPill, Segmented, EmptyState, SkeletonRows, Tone, color, radius, space, text, touch, useTr } from '../ui';

/** Server/legacy task text can carry English prefixes like "[Hospital Referral Missed]" — never show them. */
const stripLatinPrefix = (s?: string) => (s || '').replace(/^\[[^\]]*\]\s*/, '').trim();
const hasLatinWords = (s?: string) => /[A-Za-z]{3,}/.test(s || '');

export const FollowUpScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const tr = useTr();
  const { followUps, toggleFollowUp, isLoading } = useOfflineData();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');

  const pending = followUps.filter((t) => !t.isCompleted);
  const done = followUps.filter((t) => t.isCompleted);
  const list = tab === 'pending' ? pending : done;

  const statusOf = (t: FollowUpTask): { tone: Tone; label: string } => {
    if (t.isCompleted) return { tone: 'green', label: tr('पूर्ण', 'पूर्ण', 'Done') };
    if (t.choStatus === 'APPROVED_CHO') return { tone: 'green', label: tr('सत्यापित', 'पडताळले', 'Verified') };
    const missed = /missed/i.test(t.taskType) || (t.sourceReferralId != null && !t.referredToCho);
    if (missed) return { tone: 'red', label: tr('छूटा रेफरल', 'चुकलेला संदर्भ', 'Missed referral') };
    if (t.referredToCho) return { tone: 'amber', label: tr('सीएचओ समीक्षा', 'सीएचओ आढावा', 'CHO review') };
    return { tone: 'amber', label: tr('देय', 'देय', 'Due') };
  };

  return (
    <View style={styles.flex}>
      {onBack ? <AppBar title={tr('फॉलो-अप', 'पाठपुरावा', 'Follow-up')} onBack={onBack} backLabel={tr('वापस', 'मागे', 'Back')} /> : null}
      <Screen>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: 'pending', label: `${tr('बाकी', 'बाकी', 'Pending')} ${pending.length}`, icon: Clock },
            { key: 'done', label: `${tr('पूर्ण', 'पूर्ण', 'Done')} ${done.length}`, icon: CircleCheck },
          ]}
        />

        {isLoading && followUps.length === 0 ? (
          <SkeletonRows count={3} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title={tab === 'pending' ? tr('कोई बाकी काम नहीं', 'बाकी काम नाही', 'No pending work') : tr('अभी कुछ पूर्ण नहीं', 'अजून काही पूर्ण नाही', 'Nothing completed yet')}
          />
        ) : (
          list.map((item) => {
            const st = statusOf(item);
            const reason = stripLatinPrefix(item.referralReason || item.taskType);
            return (
              <Card key={item.id} tone={st.tone}>
                <View style={styles.head}>
                  <IconBadge icon={st.tone === 'green' ? CircleCheck : Route} tone={st.tone} />
                  <View style={styles.flex}>
                    <Text style={text.heading} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.houseNumber ? (
                      <Text style={text.caption}>
                        {tr('घर', 'घर', 'House')} {item.houseNumber}
                      </Text>
                    ) : null}
                  </View>
                  <StatusPill tone={st.tone} label={st.label} />
                </View>

                {reason && !hasLatinWords(reason) ? <Text style={[text.body, styles.gapTop]}>{reason}</Text> : null}

                {item.vitals && !hasLatinWords(item.vitals) ? (
                  <View style={styles.meta}>
                    <Activity size={16} color={color.muted} strokeWidth={2} />
                    <Text style={[text.caption, styles.flex]}>{item.vitals}</Text>
                  </View>
                ) : null}

                {item.prescriptionDetails ? (
                  <View style={[styles.meta, styles.rx]}>
                    <Pill size={16} color={color.amber} strokeWidth={2} />
                    <Text style={[text.caption, styles.flex, { color: color.amberText }]}>{item.prescriptionDetails}</Text>
                  </View>
                ) : null}

                {item.choAdvice ? (
                  <View style={styles.meta}>
                    <ShieldCheck size={16} color={color.green} strokeWidth={2} />
                    <Text style={[text.caption, styles.flex, { color: color.greenText }]}>{item.choAdvice}</Text>
                  </View>
                ) : null}

                {item.dueDate && !hasLatinWords(item.dueDate) ? (
                  <View style={styles.meta}>
                    <Clock size={16} color={color.muted} strokeWidth={2} />
                    <Text style={text.caption}>
                      {tr('देय तिथि', 'देय तारीख', 'Due date')}: {item.dueDate}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {item.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                      accessibilityRole="button"
                      accessibilityLabel={tr('कॉल करें', 'कॉल करा', 'Call')}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Phone size={18} color={color.accent} strokeWidth={2} />
                      <Text style={styles.actionText}>{tr('कॉल करें', 'कॉल करा', 'Call')}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => toggleFollowUp(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.isCompleted }}
                    accessibilityLabel={item.isCompleted ? tr('पूर्ण हटाएँ', 'पूर्ण काढा', 'Remove completed') : tr('पूर्ण करें', 'पूर्ण करा', 'Mark done')}
                    style={({ pressed }) => [styles.actionBtn, item.isCompleted && styles.actionDone, pressed && styles.pressed]}
                  >
                    <Check size={18} color={item.isCompleted ? color.white : color.green} strokeWidth={2.4} />
                    <Text style={[styles.actionText, { color: item.isCompleted ? color.white : color.greenText }]}>
                      {item.isCompleted ? tr('पूर्ण', 'पूर्ण', 'Done') : tr('पूर्ण करें', 'पूर्ण करा', 'Mark done')}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </Screen>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gapTop: { marginTop: space.md },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.sm },
  rx: { backgroundColor: color.amberSoft, borderRadius: radius.control, padding: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  actionBtn: {
    flex: 1,
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  actionDone: { backgroundColor: color.green, borderColor: color.green },
  actionText: { ...text.label, color: color.accent },
  pressed: { transform: [{ scale: 0.98 }] },
});
