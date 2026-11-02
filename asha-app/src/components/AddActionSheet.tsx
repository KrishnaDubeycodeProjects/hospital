/** ＋ sheet (ASHA): three big tiles — नया परिवार · जांच शुरू · रेफरल. */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HousePlus, ClipboardPlus, Route } from 'lucide-react-native';
import { Sheet, Tile, space, useTr } from '../ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNewFamily: () => void;
  onStartSurvey: () => void;
  onReferral: () => void;
}

export const AddActionSheet: React.FC<Props> = ({ visible, onClose, onNewFamily, onStartSurvey, onReferral }) => {
  const tr = useTr();
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('नया जोड़ें', 'नवीन जोडा')} closeLabel={tr('बंद करें', 'बंद करा')}>
      <View style={styles.row}>
        <Tile icon={HousePlus} label={tr('नया परिवार', 'नवीन कुटुंब')} tone="accent" onPress={pick(onNewFamily)} />
        <Tile icon={ClipboardPlus} label={tr('जांच शुरू', 'तपासणी सुरू')} tone="green" onPress={pick(onStartSurvey)} />
        <Tile icon={Route} label={tr('रेफरल', 'संदर्भ')} tone="red" onPress={pick(onReferral)} />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
});
