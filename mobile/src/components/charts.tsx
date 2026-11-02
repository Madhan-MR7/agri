import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { fmtValue } from '@/lib/format';
import { chartColors, colors, spacing } from '@/lib/theme';
import type { Contribution } from '@/lib/types';

/**
 * Diverging SHAP bars: green pushes the model towards the crop, red pushes away.
 */
export function ShapBarChart({ contributions, maxItems = 10 }: { contributions: Contribution[]; maxItems?: number }) {
  const items = contributions.slice(0, maxItems);
  if (!items.length) return null;
  const maxAbs = Math.max(...items.map((c) => Math.abs(c.shap))) || 1;

  return (
    <View>
      {items.map((c) => {
        const width = `${(Math.abs(c.shap) / maxAbs) * 100}%` as const;
        const positive = c.shap >= 0;
        const bar = <View style={[s.bar, { width, backgroundColor: positive ? colors.positive : colors.negative }]} />;
        return (
          <View key={c.feature} style={s.row}>
            <Text style={s.label} numberOfLines={1}>
              {c.label} = {fmtValue(c.value)}
            </Text>
            <View style={s.half}>{!positive && <View style={s.alignRight}>{bar}</View>}</View>
            <View style={s.axis} />
            <View style={s.half}>{positive && bar}</View>
            <Text style={[s.value, { color: positive ? colors.positive : colors.negative }]}>
              {positive ? '+' : ''}
              {c.shap.toFixed(3)}
            </Text>
          </View>
        );
      })}
      <View style={s.legend}>
        <Legend color={colors.positive} label="Supports this crop" />
        <Legend color={colors.negative} label="Works against it" />
      </View>
    </View>
  );
}

/** Simple horizontal bars for non-negative importance values. */
export function ImportanceBars({ items, color = colors.primary }: {
  items: { key: string; label: string; value: number }[];
  color?: string;
}) {
  if (!items.length) return <Text style={s.empty}>No data yet</Text>;
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <View>
      {items.map((i) => (
        <View key={i.key} style={s.row}>
          <Text style={[s.label, { width: 110 }]} numberOfLines={1}>
            {i.label}
          </Text>
          <View style={{ flex: 1 }}>
            <View style={[s.bar, { width: `${(i.value / max) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Donut chart with a legend. */
export function PieChart({ data, size = 150 }: { data: { label: string; value: number }[]; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <Text style={s.empty}>No data yet</Text>;
  const r = size / 2;
  const inner = r * 0.55;
  let angle = -Math.PI / 2;

  const arcs = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return { ...d, start, end: angle, color: chartColors[i % chartColors.length] };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Svg width={size} height={size}>
        {arcs.length === 1 ? (
          <G>
            <Circle cx={r} cy={r} r={r} fill={arcs[0].color} />
            <Circle cx={r} cy={r} r={inner} fill={colors.card} />
          </G>
        ) : (
          arcs.map((a) => <Path key={a.label} d={donutSlice(r, inner, a.start, a.end)} fill={a.color} />)
        )}
        <SvgText x={r} y={r + 6} fontSize={18} fontWeight="600" fill={colors.text} textAnchor="middle">
          {total}
        </SvgText>
      </Svg>
      <View style={{ flex: 1, gap: 4 }}>
        {arcs.map((a) => (
          <Legend key={a.label} color={a.color} label={`${a.label} (${a.value})`} />
        ))}
      </View>
    </View>
  );
}

function donutSlice(r: number, inner: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const p = (radius: number, a: number) => `${r + radius * Math.cos(a)} ${r + radius * Math.sin(a)}`;
  return [
    `M ${p(r, start)}`,
    `A ${r} ${r} 0 ${large} 1 ${p(r, end)}`,
    `L ${p(inner, end)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p(inner, start)}`,
    'Z',
  ].join(' ');
}

/** Multi-series line chart. `labels` are shown under each x position. */
export function LineChart({ series, labels, height = 180 }: {
  series: { name: string; values: number[] }[];
  labels: string[];
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const pad = { left: 32, right: 8, top: 8, bottom: 22 };
  const n = labels.length;
  const x = (i: number) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * (width - pad.left - pad.right));
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.max(1, Math.ceil(n / 5));

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={colors.border} strokeDasharray="4 4" />
              <SvgText x={pad.left - 4} y={y(t) + 4} fontSize={10} fill={colors.muted} textAnchor="end">
                {Math.round(t)}
              </SvgText>
            </G>
          ))}
          {series.map((s, si) => (
            <G key={s.name}>
              <Polyline
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke={chartColors[si % chartColors.length]}
                strokeWidth={2.5}
              />
              {s.values.map((v, i) => (
                <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={chartColors[si % chartColors.length]} />
              ))}
            </G>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <SvgText key={i} x={x(i)} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="middle">
                {l}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
      <View style={s.legend}>
        {series.map((sr, i) => (
          <Legend key={sr.name} color={chartColors[i % chartColors.length]} label={sr.name} />
        ))}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: colors.text }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  label: { width: 118, fontSize: 12, color: colors.text },
  half: { flex: 1, height: 14 },
  alignRight: { flex: 1, alignItems: 'flex-end' },
  axis: { width: 1, height: 20, backgroundColor: colors.border },
  bar: { height: 14, borderRadius: 3 },
  value: { width: 52, fontSize: 11, textAlign: 'right' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  empty: { color: colors.muted },
});
