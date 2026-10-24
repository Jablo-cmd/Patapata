import { OptionPicker, TextField } from '@/components/ui';
import { useCountries, useRegions } from '@/lib/hooks';

/** Country, region (picker where we have the list, free text otherwise) and city. */
export function LocationFields({
  country,
  region,
  city,
  onChange,
  countryError,
  countryLabel = 'Country',
  cityRequired = false,
}: {
  country: string | null;
  region: string;
  city: string;
  onChange: (v: { country: string | null; region: string; city: string }) => void;
  countryError?: string | null;
  countryLabel?: string;
  cityRequired?: boolean;
}) {
  const countries = useCountries();
  const regions = useRegions(country);
  const regionOptions = (regions.data ?? []).map((r) => ({ value: r.name, label: r.name }));

  return (
    <>
      <OptionPicker
        label={countryLabel}
        placeholder="Choose your country"
        options={countries.options}
        value={country}
        onChange={(c) => onChange({ country: c, region: '', city })}
        error={countryError}
      />
      {regionOptions.length > 0 ? (
        <OptionPicker
          label="Province / state / region (optional)"
          options={regionOptions}
          value={region || null}
          onChange={(r) => onChange({ country, region: r ?? '', city })}
          allowClear
        />
      ) : (
        <TextField
          label="Region (optional)"
          value={region}
          onChangeText={(r) => onChange({ country, region: r, city })}
          maxLength={80}
        />
      )}
      <TextField
        label={cityRequired ? 'City or town' : 'City or town (optional)'}
        value={city}
        onChangeText={(c) => onChange({ country, region, city: c })}
        maxLength={80}
        hint="Shown as a general area only. Never share your home address."
        testID="location-city"
      />
    </>
  );
}
