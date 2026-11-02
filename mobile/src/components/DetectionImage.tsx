import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { pct } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { Detection } from '@/lib/types';

/**
 * The farmer's photo with a box drawn around every leaf the model found.
 * Boxes come back normalised (0–1), so they're placed as percentages of the image.
 */
export function DetectionImage({ uri, detections }: { uri: string; detections: Detection[] }) {
  const [aspect, setAspect] = useState(1);

  return (
    <View style={[st.frame, { aspectRatio: aspect }]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="stretch"
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          if (width && height) setAspect(width / height);
        }}
      />
      {detections.map((d, i) => {
        const [x1, y1, x2, y2] = d.box;
        const color = d.healthy ? colors.positive : colors.negative;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              st.box,
              {
                left: `${x1 * 100}%`,
                top: `${y1 * 100}%`,
                width: `${(x2 - x1) * 100}%`,
                height: `${(y2 - y1) * 100}%`,
                borderColor: color,
              },
            ]}
          >
            <Text style={[st.tag, { backgroundColor: color }]} numberOfLines={1}>
              {d.label} {pct(d.confidence)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  frame: { width: '100%', borderRadius: 10, overflow: 'hidden', backgroundColor: colors.border },
  box: { position: 'absolute', borderWidth: 2, borderRadius: 4 },
  tag: {
    position: 'absolute',
    top: 0,
    left: 0,
    maxWidth: 220,
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
