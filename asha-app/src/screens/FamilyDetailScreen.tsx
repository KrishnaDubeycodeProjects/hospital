import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  ArrowLeft,
  Home,
  ChevronRight,
  Plus,
  X,
  Activity,
  Phone,
  Calendar,
  AlertTriangle,
  Droplets,
  Bath,
  CreditCard,
  UserCheck,
  ShieldAlert,
  Syringe,
} from 'lucide-react-native';
import { StatusBadge } from '../components/StatusBadge';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';
import { ChildVaccinationModal } from '../components/ChildVaccinationModal';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { FamilyMember } from '../types/storage';

interface FamilyDetailScreenProps {
  houseNo: number;
  familyName: string;
  onBack: () => void;
  onSelectMember: (member: FamilyMember) => void;
  onAddMember?: () => void;
}

export const FamilyDetailScreen: React.FC<FamilyDetailScreenProps> = ({
  houseNo = 12,
  familyName = 'Verma',
  onBack,
  onSelectMember,
}) => {
  const { families, members, childVaccinations, addMember } = useOfflineData();
  const { t } = useLanguage();

  // Locate the family
  const currentFamily =
    families.find((f) => f.houseNumber.toString() === houseNo.toString()) ||
    families.find((f) => f.headName.toLowerCase() === familyName.toLowerCase()) ||
    families[0];

  const familyMembers = currentFamily
    ? members.filter((m) => m.familyUnitId === currentFamily.id)
    : [];

  // Child Vaccination Modal State
  const [selectedChildRecord, setSelectedChildRecord] = useState<any>(null);
  const [showVaxModal, setShowVaxModal] = useState(false);

  // Add Member Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [fatherOrHusband, setFatherOrHusband] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [relationship, setRelationship] = useState('Member');
  const [education, setEducation] = useState<FamilyMember['education']>('High School');
  const [maritalStatus, setMaritalStatus] = useState<FamilyMember['maritalStatus']>('Married');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isHrp, setIsHrp] = useState(false);
  const [isChild, setIsChild] = useState(false);
  const [hasChronic, setHasChronic] = useState(false);

  const handleOpenVaccination = (member: FamilyMember) => {
    // Look up existing child vaccination record or create virtual
    const record =
      childVaccinations.find((c) => c.childMemberId === member.id) ||
      childVaccinations.find((c) => c.childName.toLowerCase() === member.name.toLowerCase()) || {
        id: `vax-${member.id}`,
        familyUnitId: currentFamily?.id || 'f012',
        childMemberId: member.id,
        childName: member.name,
        fatherName: member.fatherOrHusbandName || currentFamily?.headName || 'पिता',
        gender: member.gender,
        dob: member.dob || '01/01/2024',
        ageMonths: member.age * 12 || 12,
        phone: member.phone || currentFamily?.primaryPhone,
        mctsCode: `MCTS-${member.id.substring(0, 6)}`,
        vaccines: {
          BCG: 'Given',
          'OPV-0': 'Given',
          'Hepatitis-B-0': 'Given',
          'OPV-1': 'Given',
          'Pentavalent-1': 'Given',
          'fIPV-1': 'Given',
          'Rotavirus-1': 'Given',
          'PCV-1': 'Given',
          'OPV-2': 'Due',
          'Pentavalent-2': 'Due',
          'Rotavirus-2': 'Due',
        },
        updatedAt: new Date().toISOString(),
      };

    setSelectedChildRecord(record);
    setShowVaxModal(true);
  };

  const handleSaveMember = async () => {
    if (!name.trim() || !currentFamily) return;

    const initials = name
      .trim()
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    await addMember({
      familyUnitId: currentFamily.id,
      name: name.trim(),
      initials: initials || 'FM',
      dob: dob.trim() || undefined,
      phone: phone.trim() || undefined,
      fatherOrHusbandName: fatherOrHusband.trim() || undefined,
      age: Number(age) || (isChild ? 1 : 25),
      gender,
      relationship,
      education,
      maritalStatus,
      isAbhaLinked: false,
      isPregnant,
      isHrp,
      isChild,
      hasChronicCondition: hasChronic,
      chronicConditionType: hasChronic ? 'Chronic General' : undefined,
    });

    setName('');
    setDob('');
    setPhone('');
    setFatherOrHusband('');
    setAge('');
    setIsPregnant(false);
    setIsHrp(false);
    setIsChild(false);
    setHasChronic(false);
    setShowModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{familyName} {t('families')}</Text>
          <Text style={styles.headerSub}>{t('houseNumberLabel')}: {houseNo}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtnHeader}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Plus size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Offline Audio Guide Banner */}
        <VoiceGuideBanner
          sectionName="पारिवारिक विवरण एवं सदस्य स्वास्थ्य (Family Folder)"
          explanationHi="यहाँ परिवार का विवरण और सदस्य सूची है। ग्राम सर्वे का डेटा जैसे शौचालय और पेयजल की स्थिति देखें, और सदस्य पर टैप करके स्वास्थ्य जाँच फॉर्म खोलें।"
          explanationMr="येथे कुटुंबाचा तपशील आणि सदस्य यादी आहे. ग्राम सर्वेक्षणाचा डेटा जसे की शौचालय आणि पिण्याचे पाणी पहा आणि सदस्यावर टॅप करून फॉर्म उघडा."
          explanationEn="Here are the family details and member roster. Review gram survey data including sanitation and water source, and tap any member to open health forms."
        />

        {/* Master House Info Card */}
        <View style={styles.houseCard}>
          <View style={styles.houseIconCircle}>
            <Home size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.houseCardTitle}>{t('houseNumberLabel')}: {houseNo}</Text>
            <Text style={styles.houseCardSub}>
              {currentFamily?.headName || familyName} {t('families')} • {currentFamily?.villageName || 'Chandpur'}
            </Text>
            {/* Contact Details */}
            <View style={styles.houseMetaRow}>
              <Phone size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.houseMetaText}>
                {currentFamily?.primaryPhone || '+91 98765 00000'}
              </Text>
              {currentFamily?.headDob && (
                <>
                  <Text style={styles.houseMetaDivider}>•</Text>
                  <Calendar size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.houseMetaText}>
                    DOB: {currentFamily.headDob}
                  </Text>
                </>
              )}
            </View>
          </View>
          {currentFamily && (
            <StatusBadge type={currentFamily.status} label={currentFamily.nextVisitDate} />
          )}
        </View>

        {/* Section 3: Gram Survey Registry Card (Sanitation, Water, BPL, Caste) */}
        <View style={styles.gramSurveyCard}>
          <Text style={styles.gramSurveyTitle}>📋 ग्राम सर्वे पंजी (Household Master)</Text>
          <View style={styles.surveyGrid}>
            <View style={styles.surveyGridItem}>
              <Bath size={14} color="#0284C7" style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.surveyLabel}>शौचालय (Sanitation)</Text>
                <Text style={styles.surveyValue}>
                  {currentFamily?.toiletType || 'पक्का शौचालय (Septic)'}
                </Text>
              </View>
            </View>
            <View style={styles.surveyGridItem}>
              <Droplets size={14} color="#0284C7" style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.surveyLabel}>पेयजल (Drinking Water)</Text>
                <Text style={styles.surveyValue}>
                  {currentFamily?.waterSource || 'हैंडपंप (Handpump)'}
                </Text>
              </View>
            </View>
            <View style={styles.surveyGridItem}>
              <CreditCard size={14} color="#059669" style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.surveyLabel}>राशन कार्ड (Ration/BPL)</Text>
                <Text style={styles.surveyValue}>
                  {currentFamily?.bplCard ? '✓ BPL धारक' : 'गैर-BPL'}
                </Text>
              </View>
            </View>
            <View style={styles.surveyGridItem}>
              <UserCheck size={14} color="#7C3AED" style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.surveyLabel}>वर्ग एवं धर्म (Category)</Text>
                <Text style={styles.surveyValue}>
                  {currentFamily?.casteCategory || 'OBC'} • {currentFamily?.religion || 'Hindu'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Missed Hospital Referral Alert Banner */}
        {(currentFamily?.status === '7days' ||
          currentFamily?.status === '15days' ||
          currentFamily?.nextVisitDate?.includes('Missed Referral')) && (
          <View
            style={[
              styles.referralAlertBanner,
              currentFamily?.status === '15days' && styles.referralAlertBannerPink,
            ]}
          >
            <View
              style={[
                styles.alertIconCircle,
                currentFamily?.status === '15days' && styles.alertIconCirclePink,
              ]}
            >
              <AlertTriangle
                size={18}
                color={currentFamily?.status === '15days' ? '#BE185D' : '#DC2626'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={[
                  styles.alertTitle,
                  currentFamily?.status === '15days' && styles.alertTitlePink,
                ]}
              >
                {currentFamily?.status === '7days'
                  ? t('urgentReferralAlert')
                  : t('referral15Alert')}
              </Text>
              <Text style={styles.alertSub}>
                {currentFamily?.nextVisitDate || 'अस्पताल भेंट छूटी हुई'}. उच्च-प्राथमिकता गृह भेंट आवश्यक है।
              </Text>
            </View>
          </View>
        )}

        {/* Section Heading with Count */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('familyMembers')} ({familyMembers.length})
          </Text>
          <TouchableOpacity
            style={styles.addMemberTextBtn}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.addMemberText}>{t('addMemberBtn')}</Text>
          </TouchableOpacity>
        </View>

        {/* Members List */}
        {familyMembers.map((member) => (
          <View key={member.id} style={styles.memberCardContainer}>
            <TouchableOpacity
              style={styles.memberCard}
              onPress={() => onSelectMember(member)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.memberAvatar,
                  member.isPregnant && styles.pregnantAvatar,
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitials,
                    member.isPregnant && styles.pregnantInitials,
                  ]}
                >
                  {member.initials}
                </Text>
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.isPregnant && (
                    <View style={styles.pregnantBadge}>
                      <Text style={styles.pregnantBadgeText}>{t('pregnant')}</Text>
                    </View>
                  )}
                  {member.isHrp && (
                    <View style={styles.hrpBadge}>
                      <ShieldAlert size={11} color="#B91C1C" style={{ marginRight: 2 }} />
                      <Text style={styles.hrpBadgeText}>उच्च जोखिम (HRP)</Text>
                    </View>
                  )}
                  {member.hasChronicCondition && (
                    <View style={styles.diseaseBadge}>
                      <Activity size={12} color="#DC2626" style={{ marginRight: 2 }} />
                      <Text style={styles.diseaseBadgeText}>
                        {member.ncdDiagnosis || member.chronicConditionType || t('chronicIssue')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Demographics & Relationship */}
                <Text style={styles.memberSub}>
                  {member.gender} • {member.age} वर्ष • {member.relationship}
                  {member.fatherOrHusbandName ? ` • पिता/पति: ${member.fatherOrHusbandName}` : ''}
                </Text>

                {/* Member DOB, Education, Phone */}
                <View style={styles.memberContactRow}>
                  {member.dob && (
                    <View style={styles.memberMetaItem}>
                      <Calendar size={11} color={Colors.textSecondary} style={{ marginRight: 3 }} />
                      <Text style={styles.memberContactText}>DOB: {member.dob}</Text>
                    </View>
                  )}
                  {member.education && (
                    <Text style={styles.memberContactText}>• {member.education}</Text>
                  )}
                  {member.phone && (
                    <View style={styles.memberMetaItem}>
                      <Phone size={11} color={Colors.textSecondary} style={{ marginRight: 3 }} />
                      <Text style={styles.memberContactText}>{member.phone}</Text>
                    </View>
                  )}
                </View>

                {member.lastSurveyDate && (
                  <Text style={styles.lastSurveyText}>
                    {t('lastSurvey')}: {member.lastSurveyDate}
                  </Text>
                )}
              </View>

              <ChevronRight size={20} color={Colors.primary} />
            </TouchableOpacity>

            {/* Child Immunization Direct CTA Button */}
            {(member.isChild || member.age <= 5) && (
              <TouchableOpacity
                style={styles.vaxCtaBtn}
                onPress={() => handleOpenVaccination(member)}
                activeOpacity={0.8}
              >
                <Syringe size={14} color="#0369A1" style={{ marginRight: 6 }} />
                <Text style={styles.vaxCtaText}>
                  💉 बाल टीकाकरण पंजी देखें (Universal Immunization Card)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Child Vaccination Schedule Modal */}
      <ChildVaccinationModal
        visible={showVaxModal}
        childRecord={selectedChildRecord}
        onClose={() => setShowVaxModal(false)}
      />

      {/* Add Member Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('addMemberTitle')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.inputLabel}>{t('fullNameLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="उदा. सुनीता वर्मा"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>पिता / पति का नाम</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="उदा. राजेश वर्मा"
                placeholderTextColor={Colors.textMuted}
                value={fatherOrHusband}
                onChangeText={setFatherOrHusband}
              />

              {/* Date of Birth & Phone */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>जन्म तारीख (DD/MM/YYYY)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="12/04/1998"
                    placeholderTextColor={Colors.textMuted}
                    value={dob}
                    onChangeText={setDob}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>फ़ोन नंबर (वैकल्पिक)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('ageLabel')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="24"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                    value={age}
                    onChangeText={setAge}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('relationshipLabel')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="पत्नी / पुत्र / पुत्री"
                    placeholderTextColor={Colors.textMuted}
                    value={relationship}
                    onChangeText={setRelationship}
                  />
                </View>
              </View>

              {/* Gender Selector */}
              <Text style={styles.inputLabel}>{t('genderLabel')}</Text>
              <View style={styles.genderRow}>
                {(['Female', 'Male', 'Other'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text
                      style={[
                        styles.genderBtnText,
                        gender === g && styles.genderBtnTextActive,
                      ]}
                    >
                      {g === 'Female' ? t('female') : g === 'Male' ? t('male') : t('other')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick Health Flags */}
              <View style={styles.flagRow}>
                <TouchableOpacity
                  style={[styles.flagBtn, isPregnant && styles.flagBtnActive]}
                  onPress={() => setIsPregnant(!isPregnant)}
                >
                  <Text style={[styles.flagText, isPregnant && styles.flagTextActive]}>
                    {isPregnant ? `✓ ${t('pregnant')}` : `+ ${t('pregnant')}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.flagBtn, isHrp && styles.flagBtnActiveHrp]}
                  onPress={() => setIsHrp(!isHrp)}
                >
                  <Text style={[styles.flagText, isHrp && styles.flagTextActiveHrp]}>
                    {isHrp ? '✓ उच्च जोखिम (HRP)' : '+ उच्च जोखिम'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.flagBtn, isChild && styles.flagBtnActiveChild]}
                  onPress={() => setIsChild(!isChild)}
                >
                  <Text style={[styles.flagText, isChild && styles.flagTextActiveChild]}>
                    {isChild ? '✓ बालक (टीकाकरण)' : '+ बालक (Child)'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveMember}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>{t('saveMemberLocally')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
  },
  addBtnHeader: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: 14,
    paddingBottom: 40,
  },
  houseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  houseIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  houseCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  houseCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  houseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  houseMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  houseMetaDivider: {
    marginHorizontal: 5,
    fontSize: 10,
    color: Colors.textMuted,
  },
  // Gram Survey Card
  gramSurveyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  gramSurveyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  surveyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  surveyGridItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  surveyLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  surveyValue: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  referralAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  referralAlertBannerPink: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconCirclePink: {
    backgroundColor: '#FCE7F3',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 2,
  },
  alertTitlePink: {
    color: '#BE185D',
  },
  alertSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addMemberTextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  memberCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  memberCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pregnantAvatar: {
    backgroundColor: '#FEE2E2',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  pregnantInitials: {
    color: Colors.urgentRed,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginRight: 4,
  },
  pregnantBadge: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  pregnantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.urgentRed,
  },
  hrpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  hrpBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  diseaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  diseaseBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  memberSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  memberContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  memberMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberContactText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  lastSurveyText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  vaxCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderTopWidth: 1,
    borderTopColor: '#E0F2FE',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  vaxCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  genderBtnActive: {
    backgroundColor: Colors.primary,
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  genderBtnTextActive: {
    color: '#FFFFFF',
  },
  flagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  flagBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  flagBtnActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  flagBtnActiveHrp: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  flagBtnActiveChild: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  flagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  flagTextActive: {
    color: Colors.urgentRed,
  },
  flagTextActiveHrp: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  flagTextActiveChild: {
    color: '#0369A1',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
