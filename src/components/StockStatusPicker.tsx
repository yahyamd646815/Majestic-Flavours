import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { StockStatusBadge } from "@/components/StockStatusBadge";
import { getStatusPickerSlots, type StatusPickerSlot } from "@/lib/statusPicker";
import {
  STOCK_STATUS_BADGE_CLASSES,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_PICKER_OPTION_CLASSES,
  type StockStatus,
} from "@/lib/stockStatus";

const OPEN_SCALE = 1.08;
const CHOSEN_SCALE = 1.1;
const SLIDE_PX = 8;
const START_SCALE = 0.92;
const STAGGER_MS = 40;
const OPEN_MS = 180;
const CLOSE_MS = 140;
const CLOSE_EASING = Easing.out(Easing.quad);

const SLIDE_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

type StockStatusPickerProps = {
  status: StockStatus;
  isOverridden: boolean;
  isOpen: boolean;
  /** A status write is in flight somewhere on the screen — options go inert. */
  isBusy: boolean;
  onToggle: () => void;
  onSelect: (status: StockStatus) => void;
  /** Fires on any touch that lands on the picker, so the screen's tap-outside
   * handler can tell "inside" from "outside". */
  onTouchStart: () => void;
};

/**
 * The status badge as a button. Opens in place: the other two statuses are
 * laid out in the normal flow of the card (never floating outside its bounds,
 * where Android would not deliver their taps), and the card grows to fit.
 *
 * Open/closed lives on the screen, not here, so opening one picker closes any
 * other and a tap elsewhere can close it.
 */
export function StockStatusPicker({
  status,
  isOverridden,
  isOpen,
  isBusy,
  onToggle,
  onSelect,
  onTouchStart,
}: StockStatusPickerProps) {
  const [chosenStatus, setChosenStatus] = useState<StockStatus | null>(null);
  const slots = useMemo(() => getStatusPickerSlots(status), [status]);

  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = isOpen
      ? withSpring(OPEN_SCALE, { damping: 18, stiffness: 240 })
      : withTiming(1, { duration: CLOSE_MS, easing: CLOSE_EASING });
  }, [isOpen, scale]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handleSelect(next: StockStatus) {
    setChosenStatus(next);
    onSelect(next);
  }

  // The stagger is counted per option (top to bottom), not per slot, so the
  // first option to appear always starts immediately.
  const optionSlots = slots.filter((slot) => !slot.isCurrent);

  return (
    <View onTouchStart={onTouchStart} style={styles.column}>
      {slots.map((slot) => {
        if (slot.isCurrent) {
          return (
            <Animated.View
              key={slot.status}
              layout={LinearTransition.duration(OPEN_MS)}
              style={badgeStyle}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                hitSlop={SLIDE_HIT_SLOP}
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`Change stock status, currently ${STOCK_STATUS_LABELS[status]}`}
              >
                <StockStatusBadge status={status} isOverridden={isOverridden} />
              </TouchableOpacity>
            </Animated.View>
          );
        }

        if (!isOpen) return null;

        return (
          <StatusOption
            key={slot.status}
            slot={slot}
            index={optionSlots.indexOf(slot)}
            isBusy={isBusy}
            isChosen={isBusy && chosenStatus === slot.status}
            onSelect={handleSelect}
          />
        );
      })}
    </View>
  );
}

type StatusOptionProps = {
  slot: StatusPickerSlot;
  index: number;
  isBusy: boolean;
  isChosen: boolean;
  onSelect: (status: StockStatus) => void;
};

function StatusOption({ slot, index, isBusy, isChosen, onSelect }: StatusOptionProps) {
  // An option slides out from the badge: one above starts 8px below its final
  // spot, one below starts 8px above it.
  const slideFrom = slot.position === "above" ? SLIDE_PX : -SLIDE_PX;

  const entering = useMemo(
    () =>
      new Keyframe({
        0: { opacity: 0, transform: [{ translateY: slideFrom }, { scale: START_SCALE }] },
        100: {
          opacity: 1,
          transform: [{ translateY: 0 }, { scale: 1 }],
          easing: Easing.out(Easing.quad),
        },
      })
        .duration(OPEN_MS)
        .delay(index * STAGGER_MS),
    [slideFrom, index],
  );

  const exiting = useMemo(
    () =>
      new Keyframe({
        0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
        100: {
          opacity: 0,
          transform: [{ translateY: slideFrom }, { scale: START_SCALE }],
          easing: CLOSE_EASING,
        },
      }).duration(CLOSE_MS),
    [slideFrom],
  );

  // On its own wrapper: the entering/exiting keyframes own the outer view's
  // transform, so the "chosen" emphasis can't share it.
  const emphasis = useSharedValue(1);
  useEffect(() => {
    emphasis.value = withTiming(isChosen ? CHOSEN_SCALE : 1, {
      duration: 100,
      easing: CLOSE_EASING,
    });
  }, [isChosen, emphasis]);
  const emphasisStyle = useAnimatedStyle(() => ({ transform: [{ scale: emphasis.value }] }));

  const dimmed = isBusy && !isChosen;

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      layout={LinearTransition.duration(OPEN_MS)}
      style={styles.option}
    >
      <Animated.View style={[emphasisStyle, dimmed ? styles.dimmed : null]}>
        <TouchableOpacity
          className={STOCK_STATUS_PICKER_OPTION_CLASSES[slot.status]}
          activeOpacity={0.8}
          disabled={isBusy}
          onPress={() => onSelect(slot.status)}
          accessibilityRole="button"
          accessibilityLabel={`Set status to ${STOCK_STATUS_LABELS[slot.status]}`}
        >
          <Text className={STOCK_STATUS_BADGE_CLASSES[slot.status].text}>
            {STOCK_STATUS_LABELS[slot.status]}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "flex-end", gap: 8 },
  option: { alignItems: "flex-end" },
  dimmed: { opacity: 0.5 },
});
