import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
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
  const qrData = useMemo(() => {
    try {
      const safeValue =
        typeof value === 'string' && value.trim()
          ? value.trim()
          : typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : 'ANM-QR-SESSION-ACTIVE';

      const qr = QRCode.create(safeValue, {
        errorCorrectionLevel: 'M',
      });

      const moduleCount = qr.modules.size;
      const margin = 2;
      const totalModules = moduleCount + margin * 2;
      const cellSize = size / totalModules;

      let pathOps = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            const x = (c + margin) * cellSize;
            const y = (r + margin) * cellSize;
            pathOps += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
          }
        }
      }

      return {
        success: true,
        size,
        pathOps,
      };
    } catch (err) {
      console.error('Error generating pure SVG QR:', err);
      return { success: false, size, pathOps: '' };
    }
  }, [value, size]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.qrBox,
          {
            width: size,
            height: size,
          },
        ]}
      >
        {qrData.success ? (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
            <Path d={qrData.pathOps} fill="#000000" />
          </Svg>
        ) : (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>QR कोड लोड नहीं हुआ</Text>
          </View>
        )}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
