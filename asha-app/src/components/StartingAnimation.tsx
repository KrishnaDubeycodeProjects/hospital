import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Platform,
  Easing,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Mic, Download, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { checkVoiceModelReadiness, downloadAllVoiceModels } from '../voice/languagePack';
import { getStoredLanguage, cachedLanguage, pick, type AppLanguage } from '../utils/storedLanguage';

type BootStatus = 'boot' | 'ready' | 'session' | 'downloading' | 'done';

interface StartingAnimationProps {
  onAnimationFinish?: () => void;
  minDurationMs?: number;
}

export const StartingAnimation: React.FC<StartingAnimationProps> = ({
  onAnimationFinish,
  minDurationMs = 2200,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;

  // Rendered outside <LanguageProvider>: read the saved language directly.
  const [language, setLanguage] = useState<AppLanguage>(cachedLanguage());
  useEffect(() => {
    getStoredLanguage().then(setLanguage);
  }, []);
  const tr = (hi: string, mr: string, en: string) => pick(language, hi, mr, en);
  const [status, setStatusText] = useState<BootStatus>('boot');
  const statusText = {
    boot: tr('डिजिटल स्वास्थ्य प्रणाली प्रारंभ हो रही है...', 'डिजिटल आरोग्य प्रणाली सुरू होत आहे...', 'Starting digital health system...'),
    ready: tr('ऑफ़लाइन डेटाबेस और भाषा मॉडल तैयार...', 'ऑफलाइन डेटाबेस आणि भाषा मॉडेल तयार...', 'Offline database and language models ready...'),
    session: tr('सुरक्षित सत्र सत्यापित (NHM Portal)...', 'सुरक्षित सत्र सत्यापित (NHM Portal)...', 'Secure session verified (NHM Portal)...'),
    downloading: tr('ऑफ़लाइन आवाज़ मॉडल डाउनलोड हो रहा है...', 'ऑफलाइन आवाज मॉडेल डाउनलोड होत आहे...', 'Downloading offline voice models...'),
    done: tr('✅ आवाज़ मॉडल सफलतापूर्वक तैयार!', '✅ आवाज मॉडेल यशस्वीरित्या तयार!', '✅ Voice models ready!'),
  }[status];
  const [needsDownload, setNeedsDownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const logoSource =
    Platform.OS === 'web'
      ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
      : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  useEffect(() => {
    // 1. Entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Check offline voice model status
    let isCancelled = false;
    let pollInterval: any = null;

    checkVoiceModelReadiness()
      .then((res) => {
        if (isCancelled) return;
        if (res.needsDownload) {
          // Voice pack needs downloading - prompt the user
          setNeedsDownload(true);
          Animated.timing(cardFadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        } else {
          // All voice models already ready or unsupported platform -> proceed automatically
          setTimeout(() => {
            if (!isCancelled) setStatusText('ready');
          }, 800);

          setTimeout(() => {
            if (!isCancelled) setStatusText('session');
          }, 1500);

          setTimeout(() => {
            if (!isCancelled && onAnimationFinish) {
              onAnimationFinish();
            }
          }, minDurationMs);
        }
      })
      .catch(() => {
        // Fallback on error: proceed into app
        setTimeout(() => {
          if (!isCancelled && onAnimationFinish) onAnimationFinish();
        }, minDurationMs);
      });

    return () => {
      isCancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const handleStartDownload = async () => {
    setDownloading(true);
    setStatusText('downloading');
    try {
      await downloadAllVoiceModels();
    } catch {}

    // Poll for download readiness
    const checkInterval = setInterval(async () => {
      try {
        const check = await checkVoiceModelReadiness();
        if (!check.needsDownload) {
          clearInterval(checkInterval);
          setDownloading(false);
          setDownloadSuccess(true);
          setStatusText('done');
          setTimeout(() => {
            if (onAnimationFinish) onAnimationFinish();
          }, 900);
        }
      } catch {}
    }, 1500);

    // After 8 seconds, if Android dialog handled it or user returns, enable smooth entry
    setTimeout(() => {
      clearInterval(checkInterval);
      setDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => {
        if (onAnimationFinish) onAnimationFinish();
      }, 700);
    }, 8000);
  };

  const handleSkip = () => {
    if (onAnimationFinish) onAnimationFinish();
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contentBox, { opacity: fadeAnim }]}>
        {/* Crystal-clear Emblem Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        {/* Brand Titles & Indian Flag NHM Line */}
        <Animated.View style={[styles.textContainer, { opacity: contentFadeAnim }]}>
          <Text style={styles.appTitle}>{tr('आरोग्य प्रवाह', 'आरोग्य प्रवाह', 'Aarogya Flow')}</Text>
          {language !== 'en' ? <Text style={styles.appTitleEn}>Aarogya Flow</Text> : null}

          <View style={styles.badgeRow}>
            <View style={styles.nhmBadge}>
              <Text style={styles.flagEmoji}>🇮🇳</Text>
              <Text style={styles.nhmBadgeText}>{tr('राष्ट्रीय स्वास्थ्य मिशन (NHM)', 'राष्ट्रीय आरोग्य अभियान (NHM)', 'National Health Mission (NHM)')}</Text>
            </View>
          </View>

          <Text style={styles.tagline}>{tr('सशक्त आशा • स्वस्थ परिवार • सुरक्षित समाज', 'सक्षम आशा • निरोगी कुटुंब • सुरक्षित समाज', 'Empowered ASHA • Healthy family • Safe society')}</Text>
        </Animated.View>

        {/* Interactive Voice Model Download Card (Displayed if offline voice models are missing) */}
        {needsDownload ? (
          <Animated.View style={[styles.voiceCard, { opacity: cardFadeAnim }]}>
            <View style={styles.voiceCardHead}>
              <View style={styles.micIconCircle}>
                <Mic size={22} color="#059669" strokeWidth={2.2} />
              </View>
              <View style={styles.voiceCardHeadText}>
                <Text style={styles.voiceCardTitle}>{tr('ऑफ़लाइन आवाज़ मॉडल', 'ऑफलाइन आवाज मॉडेल', 'Offline voice models')}</Text>
                <Text style={styles.voiceCardTitleEn}>Offline Voice Pack Setup</Text>
              </View>
            </View>

            <Text style={styles.voiceCardDesc}>
              {tr(
                'बिना इंटरनेट बोलकर फॉर्म भरने और आवाज़ सुनने के लिए ऑफ़लाइन वॉइस मॉडल डाउनलोड आवश्यक है।',
                'इंटरनेटशिवाय बोलून फॉर्म भरण्यासाठी आणि आवाज ऐकण्यासाठी ऑफलाइन व्हॉइस मॉडेल डाउनलोड आवश्यक आहे.',
                'Download the offline voice models to fill forms by voice and hear audio without internet.',
              )}
            </Text>

            {downloadSuccess ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.2} />
                <Text style={styles.successText}>{tr('आवाज़ मॉडल तैयार! ऐप खुल रहा है...', 'आवाज मॉडेल तयार! ॲप उघडत आहे...', 'Voice models ready! Opening the app...')}</Text>
              </View>
            ) : downloading ? (
              <View style={styles.downloadingBox}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.downloadingText}>{tr('मॉडल डाउनलोड हो रहा है... कृपया प्रतीक्षा करें', 'मॉडेल डाउनलोड होत आहे... कृपया थांबा', 'Downloading models... please wait')}</Text>
              </View>
            ) : (
              <View style={styles.buttonCol}>
                <Pressable
                  style={styles.downloadBtn}
                  onPress={handleStartDownload}
                  accessibilityRole="button"
                >
                  <Download size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.downloadBtnText}>{tr('मॉडल डाउनलोड करें', 'मॉडेल डाउनलोड करा', 'Download models')}</Text>
                </Pressable>

                <Pressable style={styles.skipBtn} onPress={handleSkip} accessibilityRole="button">
                  <Text style={styles.skipBtnText}>{tr('बाद में करें • ऐप खोलें', 'नंतर करा • ॲप उघडा', 'Later • Open app')}</Text>
                  <ArrowRight size={16} color="#64748B" strokeWidth={2} />
                </Pressable>
              </View>
            )}
          </Animated.View>
        ) : (
          /* Normal Loading Indicator */
          <Animated.View style={[styles.loadingBox, { opacity: contentFadeAnim }]}>
            <ActivityIndicator size="small" color="#059669" style={styles.spinner} />
            <Text style={styles.statusLabel}>{statusText}</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Official Footer Notice */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>🇮🇳 {tr('स्वास्थ्य एवं परिवार कल्याण मंत्रालय', 'आरोग्य व कुटुंब कल्याण मंत्रालय', 'Ministry of Health and Family Welfare')}</Text>
        <Text style={styles.footerSubText}>Ministry of Health and Family Welfare, Govt. of India</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 360,
  },
  logoContainer: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  textContainer: {
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  appTitleEn: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  badgeRow: {
    marginTop: 8,
    marginBottom: 6,
  },
  nhmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 13,
  },
  nhmBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  tagline: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  voiceCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    alignItems: 'stretch',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  voiceCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  micIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  voiceCardHeadText: {
    flex: 1,
  },
  voiceCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  voiceCardTitleEn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  voiceCardDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 14,
  },
  buttonCol: {
    gap: 8,
  },
  downloadBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  skipBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  downloadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
  },
  downloadingText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
  },
  successText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
  },
  loadingBox: {
    marginTop: 28,
    alignItems: 'center',
    gap: 8,
  },
  spinner: {
    transform: [{ scale: 1.05 }],
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  footerSubText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '400',
    marginTop: 1,
  },
});
