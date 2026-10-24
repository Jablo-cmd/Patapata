import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Row, Text, TextField } from '@/components/ui';
import { normalizeTags, splitTags } from '@/lib/validation';

/** Pick from suggestions or add your own tags (interests, hobbies). */
export function TagPicker({
  label,
  value,
  onChange,
  suggestions = [],
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : normalizeTags([...value, tag], max));
  const add = () => {
    if (!draft.trim()) return;
    onChange(normalizeTags([...value, ...splitTags(draft)], max));
    setDraft('');
  };
  const extra = value.filter((t) => !suggestions.includes(t));

  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
        {label} ({value.length}/{max})
      </Text>
      <Row wrap gap={8}>
        {[...suggestions, ...extra].map((tag) => (
          <Chip key={tag} label={tag} selected={value.includes(tag)} onPress={() => toggle(tag)} />
        ))}
      </Row>
      <Row gap={8} align="flex-start">
        <View style={{ flex: 1 }}>
          <TextField placeholder="Add your own" value={draft} onChangeText={setDraft} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Button title="Add" variant="secondary" onPress={add} style={{ marginTop: 2 }} />
      </Row>
    </View>
  );
}
