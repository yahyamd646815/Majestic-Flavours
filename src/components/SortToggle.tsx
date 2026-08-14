import { Text, TouchableOpacity, View } from "react-native";

type SortOption<T extends string> = {
  value: T;
  label: string;
};

type SortToggleProps<T extends string> = {
  label: string;
  options: SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Generic sort-mode toggle, driven entirely by the `options` array — adding
 * a third mode (e.g. "by status" once the ping feature ships) is just
 * another array entry, not a redesign of this component. */
export function SortToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: SortToggleProps<T>) {
  return (
    <View className="gap-1.5 px-4">
      <Text className="font-inter-medium text-xs text-text-secondary">{label}</Text>
      <View className="flex-row gap-2">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              className={isActive ? "chip chip--active" : "chip"}
              activeOpacity={0.8}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${option.label}`}
              accessibilityState={{ selected: isActive }}
            >
              <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
