import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Platform,
  Easing,
  Dimensions,
} from 'react-native';
import { Colors } from '../theme/colors';

interface StartingAnimationProps {
  onAnimationFinish?: () => void;
  minDurationMs?: number;
}

const { width } = Dimensions.get('window');

export const StartingAnimation: React.FC<StartingAnimationProps> = ({
  onAnimationFinish,
  minDurationMs = 2200,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [statusText, setStatusText] = useState('डिजिटल स्वास्थ्य प्रणाली प्रारंभ हो रही है...');

  const logoSource =
    Platform.OS === 'web'
      ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
      : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  useEffect(() => {
    // 1. Entrance animation (Logo scale & fade)
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.spring(textTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 45,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: minDurationMs - 200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();

    // 2. Continuous ambient pulse for the glow ring behind the logo
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.25,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.75,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.95,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.25,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();

    // Staggered status messages
    const timer1 = setTimeout(() => {
      setStatusText('ऑफ़लाइन डेटाबेस और सिंक तैयार हो रहा है...');
    }, 800);

    const timer2 = setTimeout(() => {
      setStatusText('सुरक्षित सत्र सत्यापित (NHM Portal)...');
    }, 1500);

    const finishTimer = setTimeout(() => {
      if (onAnimationFinish) {
        onAnimationFinish();
      }
    }, minDurationMs);

    return () => {
      pulseLoop.stop();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(finishTimer);
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contentBox, { opacity: fadeAnim }]}>
        {/* Glowing Aura Ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        />

        {/* Outer Logo Badge Frame */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={logoSource}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Animated Brand Titles */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.appTitle}>आरोग्य प्रवाह</Text>
          <Text style={styles.appTitleEn}>Aarogya Flow</Text>
          <View style={styles.badgeRow}>
            <View style={styles.nhmBadge}>
              <Text style={styles.nhmBadgeText}>राष्ट्रीय स्वास्थ्य मिशन (NHM)</Text>
            </View>
          </View>
          <Text style={styles.tagline}>सशक्त आशा • स्वस्थ परिवार • सुरक्षित समाज</Text>
        </Animated.View>

        {/* Progress Bar & Status Text */}
        <Animated.View style={[styles.loadingBox, { opacity: textOpacity }]}>
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.statusLabel}>{statusText}</Text>
        </Animated.View>
      </Animated.View>

      {/* Official Footer Notice */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>स्वास्थ्य एवं परिवार कल्याण मंत्रालय</Text>
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
    paddingHorizontal: 24,
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 360,
  },
  glowRing: {
    position: 'absolute',
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#93C5FD',
    zIndex: 0,
  },
  logoWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#DBEAFE',
    zIndex: 1,
    marginBottom: 26,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  appTitleEn: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  badgeRow: {
    marginTop: 10,
    marginBottom: 8,
  },
  nhmBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  nhmBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  tagline: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  loadingBox: {
    width: '85%',
    alignItems: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  footerSubText: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '400',
    marginTop: 1,
  },
});
