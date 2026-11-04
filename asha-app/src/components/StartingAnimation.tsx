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
} from 'react-native';

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
  const [statusText, setStatusText] = useState('डिजिटल स्वास्थ्य प्रणाली प्रारंभ हो रही है...');

  const logoSource =
    Platform.OS === 'web'
      ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
      : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  useEffect(() => {
    // 1. Entrance animation (Clear logo fade & gentle scale)
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

    // 2. Status message updates
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
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(finishTimer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contentBox, { opacity: fadeAnim }]}>
        {/* Clear Logo — No blue highlights, glow rings, or borders */}
        <Animated.View
          style={[
            styles.logoContainer,
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

        {/* Brand Titles & Indian Flag NHM Line */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: contentFadeAnim,
            },
          ]}
        >
          <Text style={styles.appTitle}>आरोग्य प्रवाह</Text>
          <Text style={styles.appTitleEn}>Aarogya Flow</Text>

          {/* NHM line with Indian flag below the logo */}
          <View style={styles.badgeRow}>
            <View style={styles.nhmBadge}>
              <Text style={styles.flagEmoji}>🇮🇳</Text>
              <Text style={styles.nhmBadgeText}>राष्ट्रीय स्वास्थ्य मिशन (NHM)</Text>
            </View>
          </View>

          <Text style={styles.tagline}>सशक्त आशा • स्वस्थ परिवार • सुरक्षित समाज</Text>
        </Animated.View>

        {/* In-Between Loading Feature (Clean Spinner rather than sliding) */}
        <Animated.View style={[styles.loadingBox, { opacity: contentFadeAnim }]}>
          <ActivityIndicator size="small" color="#059669" style={styles.spinner} />
          <Text style={styles.statusLabel}>{statusText}</Text>
        </Animated.View>
      </Animated.View>

      {/* Official Footer Notice */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>🇮🇳 स्वास्थ्य एवं परिवार कल्याण मंत्रालय</Text>
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
  // Pure clear logo: zero borders, zero blue aura, zero background box
  logoContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 116,
    height: 116,
  },
  textContainer: {
    alignItems: 'center',
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
    color: '#059669',
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  badgeRow: {
    marginTop: 10,
    marginBottom: 8,
  },
  nhmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  flagEmoji: {
    fontSize: 14,
  },
  nhmBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tagline: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  // Loading feature in between rather than sliding bar
  loadingBox: {
    marginTop: 32,
    alignItems: 'center',
    gap: 10,
  },
  spinner: {
    transform: [{ scale: 1.1 }],
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
