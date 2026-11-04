import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Platform, BackHandler } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineDataProvider, useOfflineData } from './src/context/OfflineDataContext';
import { Header } from './src/components/Header';
import { FailedSyncBar } from './src/components/FailedSyncBar';
import { VoicePackBanner } from './src/components/VoicePackBanner';
import { BottomNav, TabKey, homeTabFor } from './src/components/BottomNav';
import { AddActionSheet } from './src/components/AddActionSheet';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { color } from './src/ui';
import { FamilyMember } from './src/types/storage';
import { DictationEventBridge } from './src/voice/dictation';
import { StartingAnimation } from './src/components/StartingAnimation';
import { VoiceRecognition, SpeechEngine } from './src/voice/speechEngine';
import { runBackGuard } from './src/navigation/backGuard';

// Auth (phone + OTP only — workers are registered by their CHO)
import { LoginScreen } from './src/screens/LoginScreen';

// Tab roots
import { TodayScreen } from './src/screens/TodayScreen';
import { FamiliesScreen } from './src/screens/FamiliesScreen';
import { SyncScreen } from './src/screens/SyncScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AnmOpenFormsScreen } from './src/screens/AnmOpenFormsScreen';
import { ChoDashboardScreen } from './src/screens/ChoDashboardScreen';
import { ChoPerformanceScreen } from './src/screens/ChoPerformanceScreen';

// Sub-screens
import { FamilyDetailScreen } from './src/screens/FamilyDetailScreen';
import { MemberResponsesScreen } from './src/screens/MemberResponsesScreen';
import { SurveyQuestionScreen } from './src/screens/SurveyQuestionScreen';
import { FollowUpScreen } from './src/screens/FollowUpScreen';
import { SendDataScreen } from './src/screens/SendDataScreen';
import { SyncSuccessScreen } from './src/screens/SyncSuccessScreen';
import { AnmWorkerDetailScreen, AnmMemberForms } from './src/screens/AnmWorkerDetailScreen';
import { AnmFormDetailScreen } from './src/screens/AnmFormDetailScreen';
import { AshaMeetingsScreen } from './src/screens/AshaMeetingsScreen';

/** Sub-screens pushed on top of the active tab (per-tab history; back pops). */
type SubScreen =
  | 'familyDetail'
  | 'member'
  | 'survey'
  | 'followUps'
  | 'meetings'
  | 'sendData'
  | 'syncSuccess'
  | 'anmWorkerDetail'
  | 'anmFormDetail';

type SurveyType = 'PREGNANCY' | 'CHILD' | 'OTHER';

const MainAppContent: React.FC = () => {
  const { user } = useAuth();
  const { followUps, pendingSyncCount, failedSyncCount } = useOfflineData();

  const [activeTab, setActiveTab] = useState<TabKey>(homeTabFor(user.role));
  const [stack, setStack] = useState<SubScreen[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [familiesIntent, setFamiliesIntent] = useState<{ intent: 'survey' | 'referral' | null; create: boolean }>({
    intent: null,
    create: false,
  });

  // Navigation parameters
  const [surveyFormType, setSurveyFormType] = useState<SurveyType>('PREGNANCY');
  const [selectedHouse, setSelectedHouse] = useState<{ houseNo: number; familyName: string }>({ houseNo: 0, familyName: '' });
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedAshaWorker, setSelectedAshaWorker] = useState<{ name: string; village: string; phone: string }>({
    name: '',
    village: '',
    phone: '',
  });
  const [selectedAnmMember, setSelectedAnmMember] = useState<AnmMemberForms | null>(null);

  // Roles are immutable post-login; reset to the cadre home tab if the session changes.
  useEffect(() => {
    setActiveTab(homeTabFor(user.role));
    setStack([]);
  }, [user.role]);

  const push = useCallback((s: SubScreen) => setStack((st) => [...st, s]), []);
  const pop = useCallback(() => setStack((st) => st.slice(0, -1)), []);
  const reset = useCallback(() => setStack([]), []);

  // Android hardware back pops the sub-screen stack first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (addOpen) {
        setAddOpen(false);
        return true;
      }
      // A screen with unsaved work (e.g. a half-filled survey) decides for itself.
      if (runBackGuard()) return true;
      if (stack.length > 0) {
        pop();
        return true;
      }
      if (activeTab !== homeTabFor(user.role)) {
        setActiveTab(homeTabFor(user.role));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack, activeTab, addOpen, pop, user.role]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    reset();
    if (tab === 'families') setFamiliesIntent({ intent: null, create: false });
  };

  const openFamily = (houseNo: number, familyName: string) => {
    setSelectedHouse({ houseNo, familyName });
    push('familyDetail');
  };
  const openMember = (member: FamilyMember, houseNo: number, familyName: string) => {
    setSelectedHouse({ houseNo, familyName });
    setSelectedMember(member);
    push('member');
  };
  const startSurvey = (type: SurveyType) => {
    setSurveyFormType(type);
    push('survey');
  };
  const surveyTypeFor = (m: FamilyMember | null): SurveyType =>
    m?.isPregnant ? 'PREGNANCY' : m && (m.isChild || (m.age != null && m.age <= 5)) ? 'CHILD' : 'OTHER';

  const openFromAddSheet = (intent: 'survey' | 'referral' | null, create: boolean) => {
    setFamiliesIntent({ intent, create });
    setActiveTab('families');
    reset();
  };

  const renderSubScreen = (screen: SubScreen) => {
    switch (screen) {
      case 'familyDetail':
        return (
          <FamilyDetailScreen
            houseNo={selectedHouse.houseNo}
            familyName={selectedHouse.familyName}
            onBack={pop}
            onSelectMember={(member) => {
              setSelectedMember(member);
              push('member');
            }}
          />
        );
      case 'member':
        return selectedMember ? (
          <MemberResponsesScreen
            member={selectedMember}
            houseNo={selectedHouse.houseNo}
            familyName={selectedHouse.familyName}
            onBack={pop}
            onStartNewSurvey={() => startSurvey(surveyTypeFor(selectedMember))}
          />
        ) : null;
      case 'survey':
        return (
          <SurveyQuestionScreen
            onBack={pop}
            onComplete={pop}
            familyUnitId={selectedMember?.familyUnitId}
            familyMemberId={selectedMember?.id}
            memberName={selectedMember?.name}
            formType={surveyFormType}
          />
        );
      case 'followUps':
        return <FollowUpScreen onBack={pop} />;
      case 'meetings':
        return <AshaMeetingsScreen onBack={pop} />;
      case 'sendData':
        return <SendDataScreen onBack={pop} onSuccess={() => push('syncSuccess')} />;
      case 'syncSuccess':
        return (
          <SyncSuccessScreen
            onSendAnother={pop}
            onBackToHome={() => {
              reset();
              setActiveTab(homeTabFor(user.role));
            }}
          />
        );
      case 'anmWorkerDetail':
        return (
          <AnmWorkerDetailScreen
            ashaName={selectedAshaWorker.name}
            village={selectedAshaWorker.village}
            ashaPhone={selectedAshaWorker.phone}
            onBack={pop}
            onSelectMember={(m) => {
              setSelectedAnmMember(m);
              push('anmFormDetail');
            }}
          />
        );
      case 'anmFormDetail':
        return (
          <AnmFormDetailScreen
            memberName={selectedAnmMember?.memberName}
            forms={selectedAnmMember?.forms}
            onBack={pop}
          />
        );
      default:
        return null;
    }
  };

  const renderTabRoot = () => {
    switch (activeTab) {
      case 'today':
        return <TodayScreen onOpenFamily={openFamily} onOpenMember={openMember} onOpenFollowUps={() => push('followUps')} />;
      case 'families':
        return (
          <FamiliesScreen
            intent={familiesIntent.intent}
            autoOpenCreate={familiesIntent.create}
            onSelectFamily={openFamily}
            onSelectMember={openMember}
          />
        );
      case 'sync':
        return <SyncScreen onOpenSendToAnm={() => push('sendData')} />;
      case 'anmQueue':
      case 'anmWorkers':
      case 'anmSession':
        return (
          <AnmOpenFormsScreen
            view={activeTab === 'anmQueue' ? 'queue' : activeTab === 'anmWorkers' ? 'workers' : 'session'}
            onSelectAsha={(worker) => {
              setSelectedAshaWorker(worker);
              push('anmWorkerDetail');
            }}
          />
        );
      case 'choPerformance':
        return <ChoPerformanceScreen />;
      case 'choReferrals':
      case 'choWorkers':
        return <ChoDashboardScreen view={activeTab === 'choReferrals' ? 'referrals' : 'workers'} />;
      case 'me':
      default:
        return <ProfileScreen onOpenMeetings={() => push('meetings')} />;
    }
  };

  const top = stack.length > 0 ? stack[stack.length - 1] : undefined;
  const isFormFilling = top === 'survey';
  const isSubScreen = stack.length > 0;

  const pendingTasks = followUps.filter((f) => !f.isCompleted).length;
  const badges: Partial<Record<TabKey, number>> = {
    today: pendingTasks || undefined,
    sync: failedSyncCount + pendingSyncCount || undefined,
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {!isSubScreen && <Header />}
        {!isFormFilling && <FailedSyncBar />}
        {/* Speech-to-text pack for the selected language: ask to download, show progress until ready */}
        <VoicePackBanner />

        <View style={styles.body}>{top ? renderSubScreen(top) : renderTabRoot()}</View>

        {!isFormFilling && (
          <BottomNav
            role={user.role}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onAddPress={() => setAddOpen(true)}
            badges={badges}
          />
        )}

        <AddActionSheet
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          onNewFamily={() => openFromAddSheet(null, true)}
          onStartSurvey={() => openFromAddSheet('survey', false)}
          onReferral={() => openFromAddSheet('referral', false)}
        />

        {/* Routes native speech events to whichever mic is listening (no popup). */}
        <DictationEventBridge />
      </SafeAreaView>
    </View>
  );
};

const AppRootCoordinator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isStarting, setIsStarting] = React.useState(true);

  React.useEffect(() => {
    // Probe which speech packs are on the phone (never downloads without asking the worker)
    SpeechEngine.initializeOfflineSpeech().catch(() => {});
  }, []);

  if (isStarting || isLoading) {
    return (
      <View style={styles.outerContainer}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <StartingAnimation
            minDurationMs={2000}
            onAnimationFinish={() => setIsStarting(false)}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.outerContainer}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <LoginScreen />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <LanguageProvider>
      <OfflineDataProvider>
        <MainAppContent />
      </OfflineDataProvider>
    </LanguageProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRootCoordinator />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: isWeb ? '#0F172A' : '#FFFFFF',
    alignItems: isWeb ? 'center' : 'stretch',
    justifyContent: isWeb ? 'center' : 'flex-start',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: isWeb ? 480 : undefined,
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: isWeb ? '#000' : undefined,
    shadowOffset: isWeb ? { width: 0, height: 4 } : undefined,
    shadowOpacity: isWeb ? 0.25 : undefined,
    shadowRadius: isWeb ? 16 : undefined,
    elevation: isWeb ? 8 : 0,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    backgroundColor: color.canvas,
  },
});
