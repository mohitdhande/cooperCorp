import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { Settings, Wrench, Truck } from 'lucide-react-native';
import { useAvatarTooltip, AvatarTooltipBubble } from './AvatarTooltip';
import { UserAvatar } from './UserAvatar';
import { SrNumberText } from './SrNumberText';
import { formatDate } from '../../utils/reportFormatters';

type Person = { userId: string; name: string; profilePic?: string | null; role?: string };

// Every field this header displays about the physical asset — deliberately
// a superset of what any single caller has on hand, so adding a new field
// here (e.g. dispatchDate) only ever means touching this type + the render
// below, never every caller's own prop list too.
type AssetIdentity = {
  gensetNumber?: string | null;
  engineNumber?: string | null;
  gensetModel?: string | null;
  dispatchDate?: string | null;
};

type Props = {
  task: any;
  isService: boolean;
  // getTaskPeople(task) result — passed in rather than recomputed here so
  // callers that already need it elsewhere (e.g. a card's footer avatar)
  // don't compute it twice.
  taskPeople: Person[];
  // The task-detail endpoint (getCommissioningTaskDetail/getServiceTaskById)
  // has no embedded `asset` object — only an `assetId` string — so the Task
  // Form screens fetch the asset separately and pass the whole thing
  // through here, overriding the task.asset?.X reads below field-by-field
  // (which work fine for callers that DO have a full embedded asset, e.g.
  // TaskPreviewCard). One object, not one override prop per field — a
  // caller that fetches the asset can't "forget" to wire a new field
  // through, since it's carried automatically.
  assetOverride?: AssetIdentity | null;
  // SR Approvals wants the plain S/N pair as the bold headline always, even
  // when the API sends a gensetModel — that card is specifically about
  // which physical unit needs a decision, not its model.
  hideGensetModel?: boolean;
};

// The SR-ribbon + identity pill (icon, genset/engine number, assignment
// avatars) shared by TaskPreviewCard's Active Task card and the Dashboard's
// SR Approvals card — same visual language, same gensetModel-aware text
// branching, same tap-to-reveal avatar tooltip, in exactly one place.
export function AssetIdentityHeader({ task, isService, taskPeople, assetOverride, hideGensetModel }: Props) {
  const gensetNumber = assetOverride?.gensetNumber ?? task.asset?.gensetNumber ?? task.gensetNumber;
  const engineNumber = assetOverride?.engineNumber ?? task.asset?.engineNumber ?? task.engineNumber;
  const gensetModel = assetOverride?.gensetModel ?? task.asset?.gensetModel;
  const dispatchDate = assetOverride?.dispatchDate ?? task.asset?.dispatchDate;
  // Tapping an avatar in the cluster reveals who it is — the circles alone
  // (initials or a tiny photo) aren't enough to tell people apart at that
  // size. Toggles off on a second tap of the same avatar, and also
  // auto-hides after a few seconds so it doesn't linger on screen forever.
  // Side (left/right) is measured per-tap so the pill opens toward whichever
  // side of the screen actually has room, instead of always sticking right.
  const { revealedId: revealedUserId, side: tooltipSide, toggle: toggleRevealed } = useAvatarTooltip();
  const avatarRefs = React.useRef<Record<string, View | null>>({});

  return (
    <>
      {/* A normal in-flow element, not absolutely positioned overlapping the
          card's top edge — that floating-ribbon look got clipped whenever
          this card sat inside a horizontally-clipped carousel, cutting the
          SR number off mid-render. This still reads as its own pill up top,
          just safely inside the card's own bounds. */}
      {!!task.srNumber && (
        <View style={[styles.srRibbon, isService && styles.srRibbonService]}>
          <SrNumberText srNumber={task.srNumber} style={styles.srRibbonText} />
        </View>
      )}

      <View style={[styles.idPillRow, isService && styles.idPillRowService]}>
        <View style={[styles.idIconChip, isService && styles.idIconChipService]}>
          {isService ? <Wrench size={20} color="#FFFFFF" /> : <Settings size={20} color="#FFFFFF" />}
        </View>
        <View style={{ flex: 1 }}>
          {/* gensetModel, when the API sends one, takes the bold top line
              instead — genset/engine number then move down together as the
              grey subtitle rather than genset number itself being bold. */}
          {gensetModel && !hideGensetModel ? (
            <>
              <Text style={styles.gensetNumber} numberOfLines={1}>{gensetModel}</Text>
              {!!(gensetNumber || engineNumber) && (
                <Text style={styles.engineNumber} numberOfLines={1}>
                  {[gensetNumber, engineNumber].filter(Boolean).join(' · ')}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.gensetNumber} numberOfLines={1}>{gensetNumber}</Text>
              {!!engineNumber && (
                <Text style={styles.engineNumber} numberOfLines={1}>{engineNumber}</Text>
              )}
            </>
          )}
          {!!dispatchDate && (
            <View style={styles.dispatchDateRow}>
              <Truck size={12} color="#8A8A8A" />
              <Text style={styles.dispatchDateText} numberOfLines={1}>Dispatched {formatDate(dispatchDate)}</Text>
            </View>
          )}
        </View>
        {taskPeople.length > 0 && (
          <View>
            <View style={styles.avatarCluster}>
              {taskPeople.map((person, idx) => (
                <TouchableOpacity
                  key={person.userId || idx}
                  ref={(el) => { avatarRefs.current[person.userId] = el; }}
                  style={idx > 0 && styles.clusterAvatarOverlap}
                  activeOpacity={0.7}
                  onPress={() => toggleRevealed(person.userId, { current: avatarRefs.current[person.userId] })}
                >
                  <UserAvatar userId={person.userId} name={person.name} size={40} style={styles.clusterAvatarBorder} />
                </TouchableOpacity>
              ))}
            </View>
            {(() => {
              const revealed = taskPeople.find((p) => p.userId === revealedUserId);
              if (!revealed) return null;
              return <AvatarTooltipBubble visible side={tooltipSide} name={revealed.name} role={revealed.role} />;
            })()}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  srRibbon: {
    alignSelf: 'flex-start',
    backgroundColor: '#E76124',
    borderRadius: 40,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  // Service tasks use navy instead of commissioning's orange.
  srRibbonService: { backgroundColor: '#1E1951' },
  srRibbonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  idPillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FCEEDD',
    borderRadius: 24,
    paddingVertical: 16, paddingHorizontal: 8,
  },
  idPillRowService: { backgroundColor: '#DBEAFE' },
  idIconChip: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E76124',
    justifyContent: 'center', alignItems: 'center',
  },
  idIconChipService: { backgroundColor: '#1E1951' },
  gensetNumber: { fontSize: 18, fontWeight: '700', color: '#000000' },
  engineNumber: { fontSize: 14, fontWeight: '500', color: '#8A8A8A', marginTop: 2 },
  dispatchDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  dispatchDateText: { fontSize: 12, fontWeight: '500', color: '#8A8A8A' },

  avatarCluster: { flexDirection: 'row' },
  clusterAvatarOverlap: { marginLeft: -12 },
  clusterAvatarBorder: { borderWidth: 2, borderColor: '#FFFFFF' },
});
