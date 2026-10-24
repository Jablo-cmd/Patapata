import { View } from 'react-native';

import { Row, Text, TextField } from '@/components/ui';

export type BirthDateParts = { day: string; month: string; year: string };

/** Three numeric fields: works identically on every platform and keyboard. */
export function BirthDateField({
  value,
  onChange,
  error,
}: {
  value: BirthDateParts;
  onChange: (v: BirthDateParts) => void;
  error?: string | null;
}) {
  const digits = (s: string, n: number) => s.replace(/\D/g, '').slice(0, n);
  return (
    <View style={{ gap: 4 }}>
      <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
        Date of birth (private — only used to confirm you’re 18+ and show your age if you choose)
      </Text>
      <Row gap={8} align="flex-start">
        <View style={{ flex: 1 }}>
          <TextField
            placeholder="DD"
            accessibilityLabel="Day of birth"
            keyboardType="number-pad"
            value={value.day}
            onChangeText={(t) => onChange({ ...value, day: digits(t, 2) })}
            maxLength={2}
            testID="dob-day"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            placeholder="MM"
            accessibilityLabel="Month of birth"
            keyboardType="number-pad"
            value={value.month}
            onChangeText={(t) => onChange({ ...value, month: digits(t, 2) })}
            maxLength={2}
            testID="dob-month"
          />
        </View>
        <View style={{ flex: 1.6 }}>
          <TextField
            placeholder="YYYY"
            accessibilityLabel="Year of birth"
            keyboardType="number-pad"
            value={value.year}
            onChangeText={(t) => onChange({ ...value, year: digits(t, 4) })}
            maxLength={4}
            testID="dob-year"
          />
        </View>
      </Row>
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
