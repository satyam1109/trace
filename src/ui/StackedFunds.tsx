import React, { useContext, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Icon } from '../components/Icon';
import {
  allocated,
  formatMoney,
  type Currency,
  type FinanceState,
  type Goal,
} from '../finance/model';
import { Copy, Progress } from './components';
import { GlassMotionContext, GlassPressable } from './GlassPressable';
import { useTheme } from './theme';

/** Two visible layers when folded; every currency-matched goal unfolds in place. */
export function StackedFunds({
  finance,
  currency,
  hidden,
  expanded,
  onExpandedChange,
  onGoal,
  onManage,
}: {
  finance: FinanceState;
  currency: Currency;
  hidden: boolean;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  onGoal: (goal: Goal) => void;
  onManage: () => void;
}) {
  const { colors: c, dark } = useTheme();
  const reducedMotion = useContext(GlassMotionContext);
  const { fontScale } = useWindowDimensions();
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const goals = finance.goals.filter(goal => goal.currency === currency);
  const unfolded = expanded && goals.length > 1;
  const scale = Math.max(1, fontScale);
  const compactHeight = Math.ceil(92 * scale);
  const firstHeight = Math.ceil(166 * scale);
  const otherHeight = Math.ceil(148 * scale);
  const foldedHeight = compactHeight + (goals.length > 1 ? 12 : 0);
  const openHeight =
    firstHeight + Math.max(0, goals.length - 1) * (otherHeight + 12);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: unfolded ? 1 : 0,
      duration: reducedMotion ? 0 : 520,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, unfolded, reducedMotion]);

  return (
    <View testID="savings-goal-row" style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Savings goals"
        accessibilityState={{ expanded: unfolded }}
        onPress={() =>
          goals.length > 1 ? onExpandedChange(!unfolded) : onManage()
        }
        style={styles.heading}
      >
        <Copy size={13} style={styles.medium}>
          Savings funds
        </Copy>
        <View style={styles.headingAction}>
          <Copy muted size={12}>
            {unfolded
              ? 'Collapse'
              : goals.length
              ? `${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`
              : 'Create goal'}
          </Copy>
          <View style={unfolded ? styles.chevronUp : undefined}>
            <Icon
              name={goals.length > 1 ? 'down' : 'arrow'}
              size={15}
              color={c.muted}
            />
          </View>
        </View>
      </Pressable>
      {goals.length ? (
        <Animated.View
          testID="savings-fund-stack"
          style={{
            height: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [foldedHeight, openHeight],
            }),
          }}
        >
          {goals.map((goal, index) => {
            const total = allocated(finance, goal.id);
            const percentage = Math.round((total / goal.target) * 100);
            const visible = index === 0 || unfolded;
            const position =
              index === 0
                ? 0
                : firstHeight + 12 + (index - 1) * (otherHeight + 12);
            const backgroundColor =
              index % 3 === 0
                ? dark
                  ? '#262E3B'
                  : '#E9EDF4'
                : index % 3 === 1
                ? dark
                  ? '#282D2D'
                  : '#ECEEEA'
                : dark
                ? '#332E28'
                : '#E8E2DB';
            return (
              <Animated.View
                key={goal.id}
                testID={`fund-card-${goal.id}`}
                pointerEvents={visible ? 'auto' : 'none'}
                aria-hidden={!visible}
                accessibilityElementsHidden={!visible}
                importantForAccessibility={
                  visible ? 'auto' : 'no-hide-descendants'
                }
                style={[
                  styles.cardPosition,
                  {
                    zIndex: goals.length - index,
                    height: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        compactHeight,
                        index === 0 ? firstHeight : otherHeight,
                      ],
                    }),
                    opacity: index < 2 ? 1 : progress,
                    transform: [
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [index === 0 ? 0 : 12, position],
                        }),
                      },
                      {
                        scaleX: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [index === 0 ? 1 : 0.95, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <GlassPressable
                  label={
                    !unfolded && goals.length > 1
                      ? 'Expand savings funds'
                      : `Open ${goal.name} goal`
                  }
                  onPress={() =>
                    !unfolded && goals.length > 1
                      ? onExpandedChange(true)
                      : onGoal(goal)
                  }
                  light={!dark}
                  radius={20}
                  style={styles.fill}
                  contentStyle={[styles.card, { backgroundColor }]}
                >
                  <Animated.View
                    style={{ opacity: index === 0 ? 1 : progress }}
                  >
                    <View style={styles.cardHeading}>
                      <Icon name={goal.icon} size={20} color={c.ink} />
                      <Copy size={14} style={styles.name}>
                        {goal.name}
                      </Copy>
                      <Icon name="arrowUp" size={14} color={c.muted} />
                    </View>
                    <View style={styles.amountRow}>
                      <View style={styles.amountGroup}>
                        <Animated.Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.6}
                          style={[
                            styles.amount,
                            {
                              color: c.ink,
                              fontSize: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [13, index === 0 ? 27 : 23],
                              }),
                            },
                          ]}
                        >
                          {formatMoney(total, currency, hidden)}
                        </Animated.Text>
                        <Copy muted size={11}>
                          of {formatMoney(goal.target, currency, hidden)}
                        </Copy>
                      </View>
                      <Copy muted size={11}>
                        {hidden ? '••••' : `${percentage}%`}
                      </Copy>
                    </View>
                    <Animated.View
                      pointerEvents="none"
                      aria-hidden={!unfolded}
                      accessibilityElementsHidden={!unfolded}
                      importantForAccessibility={
                        unfolded ? 'auto' : 'no-hide-descendants'
                      }
                      style={[styles.more, { opacity: progress }]}
                    >
                      <Progress
                        value={hidden ? 0 : percentage}
                        label={
                          hidden
                            ? 'Savings progress hidden'
                            : `${goal.name} saved`
                        }
                        color={c.ink}
                      />
                      <View style={styles.footer}>
                        <Copy muted size={11}>
                          {hidden
                            ? '••••'
                            : total >= goal.target
                            ? 'Goal reached'
                            : `${formatMoney(
                                goal.target - total,
                                currency,
                              )} to go`}
                        </Copy>
                        <Copy size={11}>View fund</Copy>
                      </View>
                    </Animated.View>
                  </Animated.View>
                </GlassPressable>
              </Animated.View>
            );
          })}
        </Animated.View>
      ) : null}
      {unfolded ? (
        <GlassPressable
          label="Manage savings funds"
          onPress={onManage}
          light={!dark}
          contentStyle={styles.manage}
        >
          <Copy muted size={12}>
            Manage funds & add a goal
          </Copy>
          <Icon name="arrow" size={15} color={c.muted} />
        </GlassPressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 9 },
  heading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  medium: { fontWeight: '500' },
  headingAction: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  cardPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderRadius: 20,
  },
  fill: { flex: 1 },
  card: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: 16,
    borderRadius: 20,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 24,
  },
  name: { flex: 1, fontWeight: '500' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  amountGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
    flexWrap: 'wrap',
    columnGap: 4,
  },
  amount: {
    fontWeight: '400',
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  more: { marginTop: 16, gap: 10 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  manage: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
