/**
 * परिवार फ़ोल्डर (Family detail) — house header · mark visit (R/A/neutral revisit priority) ·
 * household info · member list (tap → member; child → immunisation card) · add / delete member.
 * Same props as before.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import {
  Plus,
  Phone,
  UserCheck,
  TriangleAlert,
  Bath,
  Droplets,
  CreditCard,
  Users,
  Baby,
  ShieldAlert,
  HeartPulse,
  Syringe,
  Trash2,
  ChevronRight,
  UserPlus,
  CircleCheck,
} from 'lucide-react-native';
import { StatusBadge } from '../components/StatusBadge';
import { ChildVaccinationModal } from '../components/ChildVaccinationModal';
import { useOfflineData } from '../context/OfflineDataContext';
import { ChildVaccinationRecord, FamilyMember } from '../types/storage';
import {
  AppBar,
  Button,
  Card,
  Chips,
  Field,
  IconButton,
  SectionTitle,
  Segmented,
  Sheet,
  StatusPill,
  Tone,
  color,
  elevation,
  radius,
  space,
  text,
  tonePalette,
  touch,
  useTr,
} from '../ui';

interface FamilyDetailScreenProps {
  houseNo: number;
  familyName: string;
  onBack: () => void;
  onSelectMember: (member: FamilyMember) => void;
  onAddMember?: () => void;
}

type Priority = '7days' | '15days' | '30days';
type Gender = 'Female' | 'Male' | 'Other';

const initialsOf = (n: string) =>
  n
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const toneOfStatus = (s?: string): Tone =>
  s === '7days' ? 'red' : s === '15days' ? 'amber' : s === 'visited' ? 'green' : 'neutral';

export const FamilyDetailScreen: React.FC<FamilyDetailScreenProps> = ({ houseNo, familyName, onBack, onSelectMember }) => {
  const tr = useTr();
  const { families, members, childVaccinations, addMember, markFamilyVisited, deleteMember, deleteFamily } = useOfflineData();

  const currentFamily =
    families.find((f) => String(f.houseNumber) === String(houseNo)) ||
    families.find((f) => f.headName.toLowerCase() === familyName.toLowerCase());

  const rawMembers = currentFamily ? members.filter((m) => m.familyUnitId === currentFamily.id) : [];

  // No members synced yet → show the head so the family is never empty (no invented age / gender)
  const familyMembers: FamilyMember[] =
    rawMembers.length > 0
      ? rawMembers
      : currentFamily
      ? [
          {
            id: `head-${currentFamily.id}`,
            familyUnitId: currentFamily.id,
            name: currentFamily.headName,
            initials: initialsOf(currentFamily.headName),
            relationship: tr('मुखिया', 'कुटुंबप्रमुख'),
            phone: currentFamily.primaryPhone,
            isAbhaLinked: false,
            isPregnant: !!currentFamily.hasPregnancy,
            hasChronicCondition: !!currentFamily.hasDisease,
            isChild: !!currentFamily.hasChild,
            updatedAt: new Date().toISOString(),
          },
        ]
      : [];

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Visit priority sheet
  const [showPriority, setShowPriority] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const recordVisit = async (p: Priority) => {
    if (!currentFamily) return;
    setSavingVisit(true);
    try {
      await markFamilyVisited(currentFamily.id, p);
      setShowPriority(false);
      flash(tr('भेंट दर्ज हुई', 'भेट नोंदवली'));
    } finally {
      setSavingVisit(false);
    }
  };

  // Delete member
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const confirmDelete = async () => {
    if (!memberToDelete) return;
    const n = memberToDelete.name;
    await deleteMember(memberToDelete.id);
    setMemberToDelete(null);
    flash(`${n} — ${tr('हटाया गया', 'काढले')}`);
  };

  // Delete family (migration / created in error). Soft-deleted on the server via the DELETE_FAMILY tombstone.
  const [confirmFamilyDelete, setConfirmFamilyDelete] = useState(false);
  const [deletingFamily, setDeletingFamily] = useState(false);
  const handleDeleteFamily = async () => {
    if (!currentFamily) return;
    setDeletingFamily(true);
    try {
      await deleteFamily(currentFamily.id);
      setConfirmFamilyDelete(false);
      onBack();
    } finally {
      setDeletingFamily(false);
    }
  };

  // Immunisation card
  const [vaxRecord, setVaxRecord] = useState<ChildVaccinationRecord | null>(null);
  const openVaccination = (m: FamilyMember) => {
    const record: ChildVaccinationRecord =
      childVaccinations.find((c) => c.childMemberId === m.id) ||
      childVaccinations.find((c) => c.childName.toLowerCase() === m.name.toLowerCase()) || {
        // No record yet → empty card (every dose shows as not recorded; nothing is pre-marked "Given")
        id: `vax-${m.id}`,
        familyUnitId: currentFamily?.id || m.familyUnitId,
        childMemberId: m.id,
        childName: m.name,
        fatherName: m.fatherOrHusbandName || currentFamily?.headName || '—',
        gender: m.gender || 'Other',
        dob: m.dob || '—',
        ageMonths: m.age != null ? m.age * 12 : 0,
        phone: m.phone || currentFamily?.primaryPhone,
        vaccines: {},
        updatedAt: new Date().toISOString(),
      };
    setVaxRecord(record);
  };

  // Add member form
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [fatherOrHusband, setFatherOrHusband] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState('');
  const [gender, setGender] = useState<Gender>('Female');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isHrp, setIsHrp] = useState(false);
  const [isChild, setIsChild] = useState(false);
  const [hasChronic, setHasChronic] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);

  const ageNum = Number(age);
  const canBePregnant = gender === 'Female' && !isChild && (!age || ageNum >= 12);
  const canBeChild = !age || ageNum <= 18;

  const resetForm = () => {
    setName('');
    setFatherOrHusband('');
    setDob('');
    setPhone('');
    setAge('');
    setRelationship('');
    setGender('Female');
    setIsPregnant(false);
    setIsHrp(false);
    setIsChild(false);
    setHasChronic(false);
    setFormError(null);
  };

  const onAgeChange = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '');
    setAge(digits);
    const n = Number(digits);
    if (digits && n < 12) {
      setIsPregnant(false);
      setIsHrp(false);
    }
    if (n > 0 && n <= 5) setIsChild(true);
    else if (n > 18) setIsChild(false);
  };

  const onGenderChange = (g: Gender) => {
    setGender(g);
    if (g !== 'Female') {
      setIsPregnant(false);
      setIsHrp(false);
    }
  };

  const handleSaveMember = async () => {
    if (!currentFamily) return;
    if (!name.trim()) {
      setFormError(tr('नाम भरें', 'नाव भरा'));
      return;
    }
    if (phone && phone.length !== 10) {
      setFormError(tr('मोबाइल 10 अंक का हो', 'मोबाईल 10 अंकी हवा'));
      return;
    }
    const parsedAge = age ? ageNum : undefined;
    const pregnant = canBePregnant && isPregnant;
    setSavingMember(true);
    try {
      await addMember({
        familyUnitId: currentFamily.id,
        name: name.trim(),
        initials: initialsOf(name) || 'FM',
        dob: dob.trim() || undefined,
        phone: phone || undefined,
        fatherOrHusbandName: fatherOrHusband.trim() || undefined,
        age: parsedAge,
        gender,
        relationship: relationship.trim() || tr('सदस्य', 'सदस्य'),
        isAbhaLinked: false,
        isPregnant: pregnant,
        isHrp: pregnant && isHrp,
        isChild: isChild || (parsedAge != null && parsedAge <= 5),
        hasChronicCondition: hasChronic,
        chronicConditionType: hasChronic ? 'Chronic General' : undefined,
      });
      resetForm();
      setShowAdd(false);
      flash(tr('सदस्य जोड़ा गया', 'सदस्य जोडला'));
    } finally {
      setSavingMember(false);
    }
  };

  const status = currentFamily?.status;
  const statusTone = tonePalette(toneOfStatus(status));
  const visited = status === 'visited';
  const urgent = status === '7days' || !!currentFamily?.nextVisitDate?.includes('Missed Referral');
  const headPhone = currentFamily?.primaryPhone;

  const infoRows = [
    { icon: Bath, label: tr('शौचालय', 'शौचालय'), value: currentFamily?.toiletType },
    { icon: Droplets, label: tr('पेयजल', 'पिण्याचे पाणी'), value: currentFamily?.waterSource },
    {
      icon: CreditCard,
      label: tr('राशन कार्ड', 'रेशन कार्ड'),
      value: currentFamily?.bplCard == null ? undefined : currentFamily.bplCard ? 'BPL' : tr('गैर-BPL', 'बिगर-BPL'),
    },
    {
      icon: Users,
      label: tr('वर्ग', 'प्रवर्ग'),
      value: [currentFamily?.casteCategory, currentFamily?.religion].filter(Boolean).join(' • ') || undefined,
    },
  ].filter((r) => !!r.value);

  const priorities: { key: Priority; tone: Tone; title: string; sub: string }[] = [
    { key: '7days', tone: 'red', title: tr('7 दिन में', '7 दिवसांत'), sub: tr('गंभीर — जल्दी देखें', 'गंभीर — लवकर पाहा') },
    { key: '15days', tone: 'amber', title: tr('15 दिन में', '15 दिवसांत'), sub: tr('मध्यम — ANC / समीक्षा', 'मध्यम — ANC / आढावा') },
    { key: '30days', tone: 'neutral', title: tr('30 दिन में', '30 दिवसांत'), sub: tr('सामान्य जांच', 'नियमित तपासणी') },
  ];

  return (
    <View style={styles.container}>
      <AppBar
        title={currentFamily?.headName || familyName}
        subtitle={`${tr('घर', 'घर')} ${houseNo}`}
        onBack={onBack}
        backLabel={tr('वापस', 'मागे')}
        right={<IconButton icon={UserPlus} tone="accent" label={tr('सदस्य जोड़ें', 'सदस्य जोडा')} onPress={() => setShowAdd(true)} />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* House header */}
        <Card>
          <View style={styles.headRow}>
            <View style={[styles.houseBadge, { backgroundColor: statusTone.bg }]}>
              <Text style={[text.display, { color: statusTone.text }]}>{houseNo < 10 ? `0${houseNo}` : houseNo}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={text.heading} numberOfLines={1}>
                {currentFamily?.headName || familyName}
              </Text>
              <Text style={text.caption} numberOfLines={1}>
                {[currentFamily?.villageName, `${familyMembers.length} ${tr('सदस्य', 'सदस्य')}`].filter(Boolean).join(' • ')}
              </Text>
              {status ? (
                <View style={styles.pillRow}>
                  <StatusBadge type={status} />
                </View>
              ) : null}
            </View>
            {headPhone ? (
              <IconButton icon={Phone} tone="accent" filled label={tr('कॉल करें', 'कॉल करा')} onPress={() => Linking.openURL(`tel:${headPhone}`)} />
            ) : null}
          </View>

          <View style={styles.headAction}>
            <Button
              label={visited ? tr('प्राथमिकता बदलें', 'प्राधान्य बदला') : tr('भेंट पूर्ण', 'भेट पूर्ण')}
              icon={visited ? CircleCheck : UserCheck}
              variant={visited ? 'secondary' : 'primary'}
              onPress={() => setShowPriority(true)}
              disabled={!currentFamily}
            />
          </View>
        </Card>

        {urgent ? (
          <Card tone="red">
            <View style={styles.alertRow}>
              <TriangleAlert size={24} color={color.red} strokeWidth={2} />
              <Text style={[text.label, styles.flex, { color: color.redText }]}>
                {tr('7 दिन में भेंट ज़रूरी', '7 दिवसांत भेट आवश्यक')}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Household info — only fields that were actually recorded */}
        {infoRows.length > 0 ? (
          <Card>
            <View style={styles.infoGrid}>
              {infoRows.map((r) => {
                const Icon = r.icon;
                return (
                  <View key={r.label} style={styles.infoItem}>
                    <Icon size={20} color={color.muted} strokeWidth={2} />
                    <View style={styles.flex}>
                      <Text style={text.micro}>{r.label}</Text>
                      <Text style={text.label} numberOfLines={2}>
                        {r.value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        <SectionTitle
          label={tr('सदस्य', 'सदस्य')}
          count={familyMembers.length}
          action={<Button label={tr('जोड़ें', 'जोडा')} icon={Plus} variant="ghost" full={false} onPress={() => setShowAdd(true)} />}
        />

        {familyMembers.map((m) => {
          const pregnant = m.gender === 'Female' && m.isPregnant && (m.age == null || m.age >= 12);
          const child = !!m.isChild || (m.age != null && m.age <= 5);
          const isVirtualHead = m.id.startsWith('head-');
          const meta = [
            m.gender === 'Female' ? tr('महिला', 'स्त्री') : m.gender === 'Male' ? tr('पुरुष', 'पुरुष') : m.gender ? tr('अन्य', 'इतर') : null,
            m.age != null ? `${m.age} ${tr('वर्ष', 'वर्षे')}` : null,
            m.relationship,
          ]
            .filter(Boolean)
            .join(' • ');
          const avatarTone = tonePalette(pregnant ? 'accent' : m.hasChronicCondition ? 'red' : child ? 'amber' : 'neutral');
          return (
            <View key={m.id} style={styles.memberWrap}>
              <Pressable
                onPress={() => onSelectMember(m)}
                accessibilityRole="button"
                accessibilityLabel={m.name}
                style={({ pressed }) => [styles.memberCard, pressed && styles.pressed]}
              >
                <View style={[styles.avatar, { backgroundColor: avatarTone.bg }]}>
                  <Text style={[styles.avatarText, { color: avatarTone.text }]}>{m.initials || initialsOf(m.name)}</Text>
                </View>
                <View style={styles.memberText}>
                  <Text style={text.heading} numberOfLines={1}>
                    {m.name}
                  </Text>
                  {meta ? (
                    <Text style={text.caption} numberOfLines={1}>
                      {meta}
                    </Text>
                  ) : null}
                  {pregnant || m.isHrp || m.hasChronicCondition || child ? (
                    <View style={styles.pillRow}>
                      {pregnant ? <StatusPill tone="accent" icon={Baby} label={tr('गर्भवती', 'गरोदर')} /> : null}
                      {m.isHrp ? <StatusPill tone="red" icon={ShieldAlert} label="HRP" /> : null}
                      {m.hasChronicCondition ? <StatusPill tone="red" icon={HeartPulse} label={m.ncdDiagnosis || 'NCD'} /> : null}
                      {child ? <StatusPill tone="amber" icon={Syringe} label={tr('शिशु', 'बाळ')} /> : null}
                    </View>
                  ) : null}
                </View>
                {!isVirtualHead ? (
                  <IconButton icon={Trash2} tone="red" label={`${m.name} ${tr('हटाएं', 'काढा')}`} onPress={() => setMemberToDelete(m)} />
                ) : null}
                <ChevronRight size={20} color={color.faint} strokeWidth={2} />
              </Pressable>

              {child ? (
                <Pressable
                  onPress={() => openVaccination(m)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.vaxRow, pressed && styles.pressed]}
                >
                  <Syringe size={20} color={color.amberText} strokeWidth={2} />
                  <Text style={[text.label, styles.flex, { color: color.amberText }]}>{tr('टीकाकरण कार्ड', 'लसीकरण कार्ड')}</Text>
                  <ChevronRight size={18} color={color.amberText} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {currentFamily ? (
          <View style={styles.deleteFamilyWrap}>
            <Button
              label={tr('परिवार हटाएं (स्थलांतरण)', 'कुटुंब काढा (स्थलांतर)')}
              icon={Trash2}
              variant="danger"
              onPress={() => setConfirmFamilyDelete(true)}
            />
          </View>
        ) : null}
      </ScrollView>

      {toast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <CircleCheck size={20} color={color.white} strokeWidth={2} />
          <Text style={[text.label, { color: color.white }]}>{toast}</Text>
        </View>
      ) : null}

      {/* Revisit priority */}
      <Sheet visible={showPriority} onClose={() => setShowPriority(false)} title={tr('अगली भेंट कब?', 'पुढील भेट कधी?')} closeLabel={tr('बंद करें', 'बंद करा')}>
        <View style={styles.sheetBody}>
          {priorities.map((p) => {
            const pal = tonePalette(p.tone);
            return (
              <Pressable
                key={p.key}
                disabled={savingVisit}
                onPress={() => recordVisit(p.key)}
                accessibilityRole="button"
                accessibilityLabel={`${p.title}, ${p.sub}`}
                style={({ pressed }) => [styles.priorityCard, { backgroundColor: pal.bg, borderColor: pal.line }, pressed && styles.pressed]}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.tone === 'neutral' ? color.faint : pal.fg }]} />
                <View style={styles.flex}>
                  <Text style={[text.heading, { color: pal.text }]}>{p.title}</Text>
                  <Text style={text.caption}>{p.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* Delete member confirmation */}
      <Sheet visible={!!memberToDelete} onClose={() => setMemberToDelete(null)} title={tr('सदस्य हटाएं?', 'सदस्य काढायचा?')} closeLabel={tr('बंद करें', 'बंद करा')}>
        <View style={styles.sheetBody}>
          <Text style={text.body}>{memberToDelete?.name}</Text>
          <Button label={tr('हटाएं', 'काढा')} icon={Trash2} variant="danger" onPress={confirmDelete} />
          <Button label={tr('रद्द करें', 'रद्द करा')} variant="secondary" onPress={() => setMemberToDelete(null)} />
        </View>
      </Sheet>

      {/* Delete family confirmation */}
      <Sheet
        visible={confirmFamilyDelete}
        onClose={() => setConfirmFamilyDelete(false)}
        title={tr('क्या आप इस परिवार को हटाना चाहते हैं?', 'तुम्हाला हे कुटुंब काढायचे आहे का?')}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        <View style={styles.sheetBody}>
          <Text style={text.body}>
            {currentFamily ? `${tr('घर', 'घर')} ${currentFamily.houseNumber} — ${currentFamily.headName}` : ''}
          </Text>
          <Text style={text.caption}>
            {tr('परिवार और उसके सभी सदस्य सक्रिय सूची से हट जाएंगे।', 'कुटुंब आणि त्याचे सर्व सदस्य सक्रिय यादीतून काढले जातील.')}
          </Text>
          <Button
            label={tr('हाँ, परिवार हटाएं', 'होय, कुटुंब काढा')}
            icon={Trash2}
            variant="danger"
            loading={deletingFamily}
            onPress={handleDeleteFamily}
          />
          <Button label={tr('रद्द करें', 'रद्द करा')} variant="secondary" onPress={() => setConfirmFamilyDelete(false)} />
        </View>
      </Sheet>

      {/* Add member */}
      <Sheet
        visible={showAdd}
        onClose={() => {
          setShowAdd(false);
          setFormError(null);
        }}
        title={tr('नया सदस्य', 'नवीन सदस्य')}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label={tr('पूरा नाम', 'पूर्ण नाव')} voice="name" value={name} onChangeText={(v) => { setName(v); setFormError(null); }} autoFocus />
          <Field label={tr('पिता / पति का नाम', 'वडील / पतीचे नाव')} voice="name" value={fatherOrHusband} onChangeText={setFatherOrHusband} />
          <View style={styles.twoCol}>
            <View style={styles.flex}>
              <Field label={tr('उम्र (वर्ष)', 'वय (वर्षे)')} voice="age" value={age} onChangeText={onAgeChange} keyboardType="number-pad" maxLength={3} />
            </View>
            <View style={styles.flex}>
              <Field label={tr('रिश्ता', 'नाते')} voice="text" value={relationship} onChangeText={setRelationship} placeholder={tr('पत्नी / पुत्र', 'पत्नी / मुलगा')} />
            </View>
          </View>
          <Field label={tr('जन्म तिथि', 'जन्मतारीख')} value={dob} onChangeText={setDob} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" maxLength={10} />
          <Field
            label={tr('मोबाइल (वैकल्पिक)', 'मोबाईल (ऐच्छिक)')} voice="phone"
            value={phone}
            onChangeText={(v) => { setPhone(v.replace(/[^0-9]/g, '')); setFormError(null); }}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Text style={text.label}>{tr('लिंग', 'लिंग')}</Text>
          <Segmented
            value={gender}
            onChange={onGenderChange}
            options={[
              { key: 'Female', label: tr('महिला', 'स्त्री') },
              { key: 'Male', label: tr('पुरुष', 'पुरुष') },
              { key: 'Other', label: tr('अन्य', 'इतर') },
            ]}
          />

          <Text style={text.label}>{tr('स्वास्थ्य', 'आरोग्य')}</Text>
          <View style={styles.flagRow}>
            {canBePregnant ? (
              <FlagToggle
                label={tr('गर्भवती', 'गरोदर')}
                icon={Baby}
                tone="accent"
                on={isPregnant}
                onPress={() => {
                  const next = !isPregnant;
                  setIsPregnant(next);
                  if (!next) setIsHrp(false);
                  if (next) setIsChild(false);
                }}
              />
            ) : null}
            {canBePregnant && isPregnant ? (
              <FlagToggle label="HRP" icon={ShieldAlert} tone="red" on={isHrp} onPress={() => setIsHrp(!isHrp)} />
            ) : null}
            {canBeChild ? (
              <FlagToggle
                label={tr('शिशु', 'बाळ')}
                icon={Syringe}
                tone="amber"
                on={isChild}
                onPress={() => {
                  const next = !isChild;
                  setIsChild(next);
                  if (next) {
                    setIsPregnant(false);
                    setIsHrp(false);
                  }
                }}
              />
            ) : null}
            <FlagToggle label="NCD" icon={HeartPulse} tone="red" on={hasChronic} onPress={() => setHasChronic(!hasChronic)} />
          </View>

          {formError ? (
            <Card tone="red">
              <Text style={[text.label, { color: color.redText }]}>{formError}</Text>
            </Card>
          ) : null}
          <Button label={tr('सहेजें', 'जतन करा')} icon={UserPlus} loading={savingMember} onPress={handleSaveMember} />
        </ScrollView>
      </Sheet>

      <ChildVaccinationModal visible={!!vaxRecord} childRecord={vaxRecord} onClose={() => setVaxRecord(null)} />
    </View>
  );
};

/** Big on/off health flag (48 dp, icon + short label, tone fill when on). */
const FlagToggle: React.FC<{ label: string; icon: typeof Baby; tone: Tone; on: boolean; onPress: () => void }> = ({
  label,
  icon: Icon,
  tone,
  on,
  onPress,
}) => {
  const p = tonePalette(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.flag,
        { backgroundColor: on ? p.fg : color.surface, borderColor: on ? p.fg : color.line },
        pressed && styles.pressed,
      ]}
    >
      <Icon size={18} color={on ? color.white : p.fg} strokeWidth={2} />
      <Text style={[text.label, { color: on ? color.white : color.ink }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  deleteFamilyWrap: { marginTop: space.xl },
  container: { flex: 1, backgroundColor: color.canvas },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  houseBadge: { width: 64, height: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  headAction: { marginTop: space.md },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 4 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  infoItem: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingRight: space.sm },
  memberWrap: { gap: space.sm },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    ...elevation.card,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  memberText: { flex: 1, gap: 2 },
  vaxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingHorizontal: space.lg,
    marginLeft: space.lg,
    borderRadius: radius.control,
    backgroundColor: color.amberSoft,
    borderWidth: 1,
    borderColor: color.amberLine,
  },
  toast: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    backgroundColor: color.green,
  },
  sheetBody: { gap: space.md },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 72,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  priorityDot: { width: 16, height: 16, borderRadius: 8 },
  form: { gap: space.lg, paddingBottom: space.lg },
  twoCol: { flexDirection: 'row', gap: space.md },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
