import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineDataProvider, useOfflineData } from './src/context/OfflineDataContext';
import { Header } from './src/components/Header';
import { BottomNav, TabKey } from './src/components/BottomNav';
import { Colors } from './src/theme/colors';
import { FamilyMember } from './src/types/storage';

// Screens
import { HomeScreen } from './src/screens/HomeScreen';
import { SectionFilterScreen } from './src/screens/SectionFilterScreen';
import { FamiliesScreen } from './src/screens/FamiliesScreen';
import { FamilyDetailScreen } from './src/screens/FamilyDetailScreen';
import { MemberResponsesScreen } from './src/screens/MemberResponsesScreen';
import { SurveyQuestionScreen } from './src/screens/SurveyQuestionScreen';
import { FollowUpScreen } from './src/screens/FollowUpScreen';
import { SendDataScreen } from './src/screens/SendDataScreen';
import { SyncSuccessScreen } from './src/screens/SyncSuccessScreen';
import { AnmOpenFormsScreen } from './src/screens/AnmOpenFormsScreen';
import { AnmWorkerDetailScreen } from './src/screens/AnmWorkerDetailScreen';
import { AnmFormDetailScreen } from './src/screens/AnmFormDetailScreen';
import { ChoDashboardScreen } from './src/screens/ChoDashboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AshaMeetingsScreen } from './src/screens/AshaMeetingsScreen';

type ScreenView =
  | 'Home'
  | 'SectionFilter'
  | 'Families'
  | 'FamilyDetail'
  | 'MemberResponses'
  | 'SurveyQuestion'
  | 'FollowUps'
  | 'Meetings'
  | 'SendData'
  | 'SyncSuccess'
  | 'AnmOpenForms'
  | 'AnmWorkerDetail'
  | 'AnmFormDetail'
  | 'ChoDashboard'
  | 'Profile';

const MainAppContent: React.FC = () => {
  const { user } = useAuth();
  const { followUps } = useOfflineData();
  const [activeTab, setActiveTab] = useState<TabKey>('Home');
  const [currentScreen, setCurrentScreen] = useState<ScreenView>('Home');
  const [surveyFormType, setSurveyFormType] = useState<'PREGNANCY' | 'CHILD' | 'OTHER'>('PREGNANCY');

  // Navigation Parameters
  const [selectedHouse, setSelectedHouse] = useState<{ houseNo: number; familyName: string }>({
    houseNo: 12,
    familyName: 'Verma',
  });
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<'Pregnancy' | 'Disease' | 'Child'>('Pregnancy');
  const [selectedAshaWorker, setSelectedAshaWorker] = useState<{ name: string; village: string }>({
    name: 'Sunita Devi',
    village: 'Chandpur Village',
  });

  // Automatically react to role changes from header / profile
  React.useEffect(() => {
    if (user.role === 'CHO') {
      setCurrentScreen('ChoDashboard');
    } else if (user.role === 'ANM') {
      setCurrentScreen('AnmOpenForms');
    } else {
      setCurrentScreen('Home');
    }
  }, [user.role]);

  const pendingFollowUpsCount = followUps.filter((f) => !f.isCompleted).length;

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'Home') {
      if (user.role === 'CHO') setCurrentScreen('ChoDashboard');
      else if (user.role === 'ANM') setCurrentScreen('AnmOpenForms');
      else setCurrentScreen('Home');
    } else if (tab === 'Profile') {
      setCurrentScreen('Profile');
    } else if (user.role === 'ASHA') {
      // Only ASHA can access these screens
      if (tab === 'Families') setCurrentScreen('Families');
      else if (tab === 'FollowUps') setCurrentScreen('FollowUps');
      else if (tab === 'Meetings') setCurrentScreen('Meetings');
    }
  };

  const renderActiveScreen = () => {
    if (user.role === 'CHO' && (currentScreen === 'Home' || currentScreen === 'ChoDashboard')) {
      return <ChoDashboardScreen />;
    }
    if (user.role === 'ANM' && (currentScreen === 'Home' || currentScreen === 'AnmOpenForms')) {
      return <AnmOpenFormsScreen />;
    }

    switch (currentScreen) {
      case 'Home':
        return (
          <HomeScreen
            onOpenPregnancyForm={(member, familyId) => {
              setSelectedMember(member);
              setSurveyFormType('PREGNANCY');
              setCurrentScreen('SurveyQuestion');
            }}
            onOpenChildForm={(member, familyId) => {
              setSelectedMember(member);
              setSurveyFormType('CHILD');
              setCurrentScreen('SurveyQuestion');
            }}
            onOpenOtherServiceForm={(member, familyId, serviceType) => {
              setSelectedMember(member);
              setSurveyFormType('OTHER');
              setCurrentScreen('SurveyQuestion');
            }}
            onNavigateToSync={() => setCurrentScreen('SendData')}
            onNavigateToFamilyDetail={(houseNo, familyName) => {
              setSelectedHouse({ houseNo, familyName });
              setCurrentScreen('FamilyDetail');
            }}
          />
        );

      case 'SectionFilter':
        return (
          <SectionFilterScreen
            initialCategory={selectedFilterCategory}
            onBack={() => setCurrentScreen('Home')}
            onApply={() => setCurrentScreen('Home')}
          />
        );

      case 'Families':
        return (
          <FamiliesScreen
            onSelectFamily={(houseNo, familyName) => {
              setSelectedHouse({ houseNo, familyName });
              setCurrentScreen('FamilyDetail');
            }}
            onSelectMember={(member, houseNo, familyName) => {
              setSelectedHouse({ houseNo, familyName });
              setSelectedMember(member);
              setCurrentScreen('MemberResponses');
            }}
          />
        );

      case 'FamilyDetail':
        return (
          <FamilyDetailScreen
            houseNo={selectedHouse.houseNo}
            familyName={selectedHouse.familyName}
            onBack={() => setCurrentScreen('Home')}
            onSelectMember={(member) => {
              setSelectedMember(member);
              setCurrentScreen('MemberResponses');
            }}
            onAddMember={() => setCurrentScreen('FamilyDetail')}
          />
        );

      case 'MemberResponses':
        return selectedMember ? (
          <MemberResponsesScreen
            member={selectedMember}
            houseNo={selectedHouse.houseNo}
            familyName={selectedHouse.familyName}
            onBack={() => setCurrentScreen('FamilyDetail')}
            onStartNewSurvey={() => {
              setSurveyFormType('PREGNANCY');
              setCurrentScreen('SurveyQuestion');
            }}
          />
        ) : (
          <FamilyDetailScreen
            houseNo={selectedHouse.houseNo}
            familyName={selectedHouse.familyName}
            onBack={() => setCurrentScreen('Home')}
            onSelectMember={(member) => {
              setSelectedMember(member);
              setCurrentScreen('MemberResponses');
            }}
          />
        );

      case 'SurveyQuestion':
        return (
          <SurveyQuestionScreen
            onBack={() => setCurrentScreen('Home')}
            onComplete={() => setCurrentScreen('Home')}
            familyUnitId={selectedMember?.familyUnitId}
            familyMemberId={selectedMember?.id}
            memberName={selectedMember?.name}
            formType={surveyFormType}
          />
        );

      case 'FollowUps':
        return <FollowUpScreen />;

      case 'Meetings':
        return <AshaMeetingsScreen />;

      case 'SendData':
        return (
          <SendDataScreen
            onBack={() => setCurrentScreen('Home')}
            onSuccess={() => setCurrentScreen('SyncSuccess')}
          />
        );

      case 'SyncSuccess':
        return (
          <SyncSuccessScreen
            onSendAnother={() => setCurrentScreen('SendData')}
            onBackToHome={() => setCurrentScreen('Home')}
          />
        );

      case 'AnmOpenForms':
        return (
          <AnmOpenFormsScreen
            onSelectAsha={(worker) => {
              setSelectedAshaWorker({ name: worker.name, village: worker.village });
              setCurrentScreen('AnmWorkerDetail');
            }}
          />
        );

      case 'AnmWorkerDetail':
        return (
          <AnmWorkerDetailScreen
            ashaName={selectedAshaWorker.name}
            village={selectedAshaWorker.village}
            onBack={() => setCurrentScreen('AnmOpenForms')}
            onSelectForm={() => setCurrentScreen('AnmFormDetail')}
          />
        );

      case 'AnmFormDetail':
        return (
          <AnmFormDetailScreen
            onBack={() => setCurrentScreen('AnmWorkerDetail')}
          />
        );

      case 'ChoDashboard':
        return <ChoDashboardScreen />;

      case 'Profile':
      default:
        return <ProfileScreen />;
    }
  };

  const isFormFilling = currentScreen === 'SurveyQuestion';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Universal Top Header with Aarogya Flow branding and offline sync status */}
      {!isFormFilling && <Header />}

      {/* Main Screen Surface */}
      <View style={styles.body}>{renderActiveScreen()}</View>

      {/* Persistent Bottom Navigation Bar */}
      {!isFormFilling && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          followUpCount={pendingFollowUpsCount}
        />
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <OfflineDataProvider>
          <MainAppContent />
        </OfflineDataProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
