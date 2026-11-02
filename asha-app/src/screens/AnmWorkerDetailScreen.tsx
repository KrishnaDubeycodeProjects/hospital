/**
 * ANM → one ASHA: the members whose forms this ASHA has sent, grouped per member (newest first).
 * Only real server data is shown; loading / empty / error states are explicit.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { HeartPulse, Baby, Activity, ClipboardList, CloudOff, RotateCcw, Inbox, type LucideIcon } from 'lucide-react-native';
import { SyncApi, AnmSurveyForm } from '../api/syncApi';
import { Screen, AppBar, Card, ListRow, StatusPill, SectionTitle, EmptyState, SkeletonRows, Button, Stat, Tone, color, space, useTr } from '../ui';

export interface AnmMemberForms {
  memberName: string;
  familyHeadName?: string;
  forms: AnmSurveyForm[];
}

interface AnmWorkerDetailScreenProps {
  ashaName?: string;
  village?: string;
  ashaPhone?: string;
  onBack: () => void;
  onSelectMember: (member: AnmMemberForms) => void;
}

export const categoryMeta = (
  code: string,
  tr: (hi: string, mr: string) => string
): { icon: LucideIcon; tone: Tone; label: string } =>
  code === 'PREGNANCY'
    ? { icon: HeartPulse, tone: 'red', label: tr('गर्भावस्था', 'गर्भधारणा') }
    : code === 'CHILD'
    ? { icon: Baby, tone: 'accent', label: tr('बाल स्वास्थ्य', 'बाल आरोग्य') }
    : code === 'DISEASE'
    ? { icon: Activity, tone: 'amber', label: tr('रोग जांच', 'आजार तपासणी') }
    : { icon: ClipboardList, tone: 'neutral', label: tr('सामान्य', 'सामान्य') };

export const AnmWorkerDetailScreen: React.FC<AnmWorkerDetailScreenProps> = ({
  ashaName = '',
  village,
  ashaPhone,
  onBack,
  onSelectMember,
}) => {
  const tr = useTr();
  const [forms, setForms] = useState<AnmSurveyForm[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    if (!ashaPhone) {
      setState('ready');
      return;
    }
    setState('loading');
    try {
      setForms(await SyncApi.getAnmAshaForms(ashaPhone));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [ashaPhone]);

  useEffect(() => {
    load();
  }, [load]);

  const members = useMemo(() => {
    const byKey = new Map<string, AnmMemberForms>();
    for (const f of forms) {
      const key = f.familyMemberId ? `m${f.familyMemberId}` : `f${f.id}`;
      const g = byKey.get(key) || { memberName: f.memberName || tr('नाम दर्ज नहीं', 'नाव नोंद नाही'), familyHeadName: f.familyHeadName, forms: [] };
      g.forms.push(f);
      byKey.set(key, g);
    }
    return [...byKey.values()]; // server returns newest first, so groups keep that order
  }, [forms, tr]);

  return (
    <View style={styles.flex}>
      <AppBar title={ashaName} subtitle={village || undefined} onBack={onBack} backLabel={tr('वापस', 'मागे')} />
      <Screen>
        {state === 'loading' ? (
          <SkeletonRows count={5} />
        ) : state === 'error' ? (
          <EmptyState
            icon={CloudOff}
            tone="amber"
            title={tr('डेटा लोड नहीं हुआ', 'डेटा लोड झाला नाही')}
            action={<Button label={tr('फिर कोशिश', 'पुन्हा प्रयत्न')} icon={RotateCcw} variant="secondary" full={false} onPress={load} />}
          />
        ) : members.length === 0 ? (
          <EmptyState icon={Inbox} tone="neutral" title={tr('अभी कोई फॉर्म नहीं', 'अजून फॉर्म नाही')} />
        ) : (
          <>
            <Card>
              <View style={styles.statsRow}>
                <Stat value={forms.length} label={tr('फॉर्म', 'फॉर्म')} tone="amber" />
                <View style={styles.vr} />
                <Stat value={members.length} label={tr('सदस्य', 'सदस्य')} tone="neutral" />
              </View>
            </Card>
            <SectionTitle label={tr('सदस्य', 'सदस्य')} count={members.length} />
            <View style={styles.list}>
              {members.map((m, i) => {
                const meta = categoryMeta(m.forms[0].categoryCode, tr);
                return (
                  <ListRow
                    key={`${m.memberName}-${i}`}
                    icon={meta.icon}
                    tone={meta.tone}
                    title={m.memberName}
                    subtitle={m.familyHeadName ? `${tr('परिवार', 'कुटुंब')}: ${m.familyHeadName}` : undefined}
                    onPress={() => onSelectMember(m)}
                    right={<StatusPill tone={meta.tone} label={m.forms.length > 1 ? `${meta.label} +${m.forms.length - 1}` : meta.label} />}
                  />
                );
              })}
            </View>
          </>
        )}
      </Screen>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  vr: { width: 1, alignSelf: 'stretch', backgroundColor: color.line },
  list: { gap: space.sm },
});
