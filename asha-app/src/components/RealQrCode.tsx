import React, { useEffect, useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, Text } from 'react-native';
import QRCode from 'qrcode';

interface RealQrCodeProps {
  value: string;
  size?: number;
  label?: string;
}

export const RealQrCode: React.FC<RealQrCodeProps> = ({
  value,
  size = 180,
  label,
}) => {
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#114B33',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setQrUri(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error generating real QR:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <ActivityIndicator size="large" color="#1A6B4A" />
        </View>
      ) : qrUri ? (
        <Image
          source={{ uri: qrUri }}
          style={{ width: size, height: size, borderRadius: 8 }}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.errorText}>QR कोड लोड नहीं हुआ</Text>
        </View>
      )}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 6,
  },
});
