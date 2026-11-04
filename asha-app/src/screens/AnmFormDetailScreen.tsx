/**
 * ANM → one member's forms sent by an ASHA. Summary + full answers come from the shared
 * clinical-summary engine run on the real survey answers; tap the summary to hear it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Volume2, VolumeX, CircleCheck, CircleAlert, Info, Inbox } from 'lucide-react-native';
import { AnmSurveyForm } from '../api/syncApi';
import { FamilyMember, SurveyResponse } from '../types/storage';
import { generateClinicalSummary } from '../services/clinicalSummary';
import { SpeechEngine } from '../voice/speechEngine';
import { useLanguage } from '../context/LanguageContext';
import { Screen, AppBar, Card, ListRow, StatusPill, SectionTitle, EmptyState, Button, Segmented, color, space, text, useTr } from '../ui';
import { categoryMeta } from './AnmWorkerDetailScreen';

interface AnmFormDetailScreenProps {
  memberName?: string;
  forms?: AnmSurveyForm[];
  onBack: () => void;
}

type Category = SurveyResponse['categoryCode'];
const asCategory = (c: string): Category =>
  c === 'PREGNANCY' || c === 'CHILD' || c === 'DISEASE' ? c : 'GENERAL';

/** Member facts implied by the form itself (pregnancy form ⇒ female & pregnant). Nothing else is assumed. */
function memberFromForm(f: AnmSurveyForm, name: string): FamilyMember {
  const cat = asCategory(f.categoryCode);
  return {
    id: String(f.familyMemberId ?? f.id),
    familyUnitId: String(f.familyUnitId ?? ''),
    name,
    initials: name.slice(0, 2),
    relationship: '',
    gender: cat === 'PREGNANCY' ? 'Female' : undefined,
    isAbhaLinked: false,
    isPregnant: cat === 'PREGNANCY',
    hasChronicCondition: cat === 'DISEASE',
    isChild: cat === 'CHILD',
    updatedAt: f.syncedAt || f.createdAt || '',
  };
}

function toSurvey(f: AnmSurveyForm): SurveyResponse {
  return {
    id: f.offlineId || String(f.id),
    familyUnitId: String(f.familyUnitId ?? ''),
    familyMemberId: String(f.familyMemberId ?? ''),
    categoryCode: asCategory(f.categoryCode),
    ashaWorkerPhone: f.ashaWorkerPhone,
    answers: f.answers || {},
    syncedToAnm: true,
    syncedAt: f.syncedAt,
    createdAt: f.createdAt || '',
  };
}

export const AnmFormDetailScreen: React.FC<AnmFormDetailScreenProps> = ({ memberName = '', forms = [], onBack }) => {
  const tr = useTr();
  const { language, localeCode, ttsEnabled } = useLanguage();
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<'summary' | 'form'>('summary');
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => SpeechEngine.stop(), []);

  const form = forms[index];
  const summary = useMemo(
    () => (form ? generateClinicalSummary(memberFromForm(form, memberName), toSurvey(form), language) : null),
    [form, memberName, language]
  );
  const meta = form ? categoryMeta(form.categoryCode, tr) : null;

  const toggleSpeak = () => {
    if (!summary) return;
    if (speaking) {
      SpeechEngine.stop();
      setSpeaking(false);
      return;
    }
    SpeechEngine.speak(summary.spokenText, localeCode, 0.9, () => setSpeaking(true), () => setSpeaking(false));
  };

  const selectForm = (i: number) => {
    SpeechEngine.stop();
    setSpeaking(false);
    setIndex(i);
  };

  return (
    <View style={styles.flex}>
      <AppBar title={memberName} subtitle={meta?.label} onBack={onBack} backLabel={tr('वापस', 'मागे', 'Back')} />
      {!form || !summary || !meta ? (
        <Screen>
          <EmptyState icon={Inbox} tone="neutral" title={tr('कोई फॉर्म नहीं', 'फॉर्म नाही', 'No forms')} />
        </Screen>
      ) : (
        <Screen>
          {forms.length > 1 ? (
            <>
              <SectionTitle label={tr('फॉर्म', 'फॉर्म', 'Form')} count={forms.length} />
              <View style={styles.list}>
                {forms.map((f, i) => {
                  const m = categoryMeta(f.categoryCode, tr);
                  return (
                    <ListRow
                      key={f.id}
                      icon={m.icon}
                      tone={i === index ? m.tone : 'neutral'}
                      title={m.label}
                      subtitle={f.createdAt ? f.createdAt.slice(0, 10).split('-').reverse().join('/') : undefined}
                      onPress={() => selectForm(i)}
                      right={i === index ? <StatusPill tone="accent" label={tr('खुला', 'उघडा', 'Open')} /> : undefined}
                    />
                  );
                })}
              </View>
            </>
          ) : null}

          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: 'summary', label: tr('संक्षेप', 'सारांश', 'Summary') },
              { key: 'form', label: tr('पूरा फॉर्म', 'पूर्ण फॉर्म', 'Full form') },
            ]}
          />

          {tab === 'summary' ? (
            <Card tone={summary.highlights.some((h) => h.isAlert) ? 'red' : 'green'}>
              <View style={styles.summaryHead}>
                <StatusPill tone={meta.tone} label={summary.surveyDate} />
                {ttsEnabled ? (
                  <Button
                    label={speaking ? tr('रोकें', 'थांबवा', 'Stop') : tr('सुनें', 'ऐका', 'Listen')}
                    icon={speaking ? VolumeX : Volume2}
                    variant="secondary"
                    full={false}
                    onPress={toggleSpeak}
                  />
                ) : null}
              </View>
              {summary.highlights.length === 0 ? (
                <Text style={text.body}>{tr('कोई जानकारी दर्ज नहीं', 'कोणतीही माहिती नोंद नाही', 'No information recorded')}</Text>
              ) : (
                <View style={styles.list}>
                  {summary.highlights.map((h) => (
                    <ListRow
                      key={h.id}
                      icon={h.statusType === 'alert' ? CircleAlert : h.statusType === 'check' ? CircleCheck : Info}
                      tone={h.statusType === 'alert' ? 'red' : h.statusType === 'check' ? 'green' : 'neutral'}
                      title={h.value}
                      subtitle={h.label}
                    />
                  ))}
                </View>
              )}
            </Card>
          ) : summary.detailedEntries.length === 0 ? (
            <EmptyState icon={Inbox} tone="neutral" title={tr('उत्तर दर्ज नहीं', 'उत्तरे नोंद नाहीत', 'No answer recorded')} />
          ) : (
            <View style={styles.list}>
              {summary.detailedEntries.map((e) => (
                <ListRow
                  key={e.questionNumber}
                  icon={e.isNormal ? CircleCheck : CircleAlert}
                  tone={e.isNormal ? 'green' : 'red'}
                  title={e.answerText}
                  subtitle={e.note ? `${e.questionText} • ${e.note}` : e.questionText}
                />
              ))}
            </View>
          )}
        </Screen>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  list: { gap: space.sm },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
});
