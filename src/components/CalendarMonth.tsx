import { Text, TouchableOpacity, View } from "react-native";

/** Sunday-first, matching the 0=Sunday convention `days_of_week` and
 * `Date.prototype.getDay()` both use. */
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** `YYYY-MM-DD` for a Riyadh calendar day — the same string shape
 * `customDates`, `endsOnDate` and `getTodayIsoDate` all speak. */
export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

type CalendarMonthProps = {
  year: number;
  /** 1-indexed, so it reads the same way a `YYYY-MM-DD` string does. */
  month: number;
  /** `YYYY-MM-DD` days drawn as picked. */
  selectedDates: Set<string>;
  /** Optional caption under a selected day — the preview uses it to show how
   * many times of day that date carries. */
  dayCaptions?: Map<string, string>;
  /** Omit for a read-only calendar; every day is then non-interactive. */
  onToggleDate?: (isoDate: string) => void;
  /** `YYYY-MM-DD`; earlier days cannot be picked. */
  minDate?: string;
  /** `YYYY-MM-DD`; later days cannot be picked. */
  maxDate?: string;
};

/**
 * One month as a seven-column grid, shared by the date picker (tappable) and
 * the occurrence preview (read-only). All calendar arithmetic is done in UTC
 * components deliberately: a year/month/day here is a set of Riyadh digits
 * rather than an instant, and UTC is the only offset that never shifts a day
 * boundary underneath it — the same reasoning as `lib/taskRecurrence.ts`.
 */
export function CalendarMonth({
  year,
  month,
  selectedDates,
  dayCaptions,
  onToggleDate,
  minDate,
  maxDate,
}: CalendarMonthProps) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Leading blanks push the 1st onto its real weekday. Keys are index-based
  // because a blank has no date of its own to key on.
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];

  return (
    <View className="gap-1">
      <Text className="font-inter-semibold text-sm text-maroon">
        {MONTH_NAMES[month - 1]} {year}
      </Text>

      <View className="flex-row flex-wrap">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={`weekday-${index}`} className="w-[14.28%] items-center py-1">
            <Text className="font-inter-medium text-xs text-text-secondary">{initial}</Text>
          </View>
        ))}

        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`blank-${index}`} className="w-[14.28%] py-1" />;
          }

          const isoDate = toIsoDate(year, month, day);
          const isSelected = selectedDates.has(isoDate);
          const isDisabled =
            (minDate !== undefined && isoDate < minDate) ||
            (maxDate !== undefined && isoDate > maxDate);
          const caption = dayCaptions?.get(isoDate);

          const content = (
            <>
              <Text
                className={
                  isSelected
                    ? "font-inter-semibold text-sm text-text-primary"
                    : "font-inter text-sm text-text-primary"
                }
              >
                {day}
              </Text>
              {caption ? (
                <Text className="font-inter text-[9px] text-text-primary">{caption}</Text>
              ) : null}
            </>
          );

          // A read-only calendar renders plain Views rather than disabled
          // buttons, so nothing in the preview reads as tappable.
          if (onToggleDate === undefined) {
            return (
              <View key={isoDate} className="w-[14.28%] items-center py-0.5">
                <View
                  className={
                    isSelected
                      ? "h-9 w-9 items-center justify-center rounded-full bg-gold"
                      : "h-9 w-9 items-center justify-center rounded-full"
                  }
                >
                  {content}
                </View>
              </View>
            );
          }

          return (
            <View key={isoDate} className="w-[14.28%] items-center py-0.5">
              <TouchableOpacity
                className={
                  isSelected
                    ? "h-9 w-9 items-center justify-center rounded-full bg-gold"
                    : isDisabled
                      ? "h-9 w-9 items-center justify-center rounded-full opacity-30"
                      : "h-9 w-9 items-center justify-center rounded-full border border-border"
                }
                activeOpacity={isDisabled ? 1 : 0.8}
                disabled={isDisabled}
                onPress={() => onToggleDate(isoDate)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                accessibilityLabel={`${day} ${MONTH_NAMES[month - 1]} ${year}`}
              >
                {content}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}
