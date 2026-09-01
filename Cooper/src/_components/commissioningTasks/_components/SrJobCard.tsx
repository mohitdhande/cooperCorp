import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { formatSrDate, formatSrDateTime, getSrRelativeLabel } from '../helpers';
import { getSrStatusStyle, getWorkApprovalStyle } from '@/utils/statusStyles';

export const SrJobCard = ({
  task,
  effectiveStatus,
  isLoading,
  errorMsg,
  onAccept,
  onStart,
  onContinue,
  onViewReport,
}: {
  task: any;
  effectiveStatus: string;
  isLoading: boolean;
  errorMsg?: string;
  onAccept: () => void;
  onStart: () => void;
  onContinue: () => void;
  onViewReport: () => void;
}) => {
  const asset = task.asset || {};
  const address = asset.address || {};
  const statusStyle = getSrStatusStyle(task.status);
  const dispatchRel = getSrRelativeLabel(asset.dispatchDate);
  const assignedRel = getSrRelativeLabel(task.assignedAt);
  const dueRel = getSrRelativeLabel(task.dueDate);
  const updatedRel = getSrRelativeLabel(task.updatedAt);

  const subtitleParts = [
    asset.gensetNumber,
    task.productSnapshot?.gensetModel,
    task.productSnapshot?.kva ? `${task.productSnapshot.kva} KVA` : null,
  ].filter(Boolean);
  return (
    <View style={srStyles.card}>
      {/* Top row: title + genset number (left) / category + status (right) */}
      <View style={srStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={srStyles.title}>{task.title || '—'}</Text>
          <Text style={srStyles.gensetNumber}>{subtitleParts.length ? subtitleParts.join(' · ') : '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {task.category ? (
            <View style={srStyles.categoryBadge}>
              <Text style={srStyles.categoryBadgeText}>
                ●  {task.category} — {task.subCategory}
              </Text>
            </View>
          ) : (
            <View style={srStyles.noCategoryBadge}>
              <Text style={srStyles.noCategoryBadgeText}>No Category Yet</Text>
            </View>
          )}
          <View style={[srStyles.statusBadge, { backgroundColor: statusStyle.bg, marginTop: 6 }]}>
            <Text style={[srStyles.statusBadgeText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>
      </View>

      {/* Engine S/N + Dispatch Date row */}
      <View style={srStyles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={srStyles.infoLabel}>Engine S/N</Text>
          <Text style={srStyles.infoValue}>{asset.engineNumber || '—'}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={srStyles.infoLabel}>Dispatch Date</Text>
          <Text style={srStyles.infoValue}>
            {formatSrDate(asset.dispatchDate)}{' '}
            <Text style={srStyles.relativeRed}>{dispatchRel.label}</Text>
          </Text>
        </View>
      </View>

      {/* Client + address + contact box */}
      <View style={srStyles.clientBox}>
        <Text style={srStyles.clientName}>🏢 {asset.clientName || '—'}</Text>
        <Text style={srStyles.clientDetail}>
          📍 {address.line1 || '—'} · {address.pinCode || '—'}
        </Text>
        <Text style={srStyles.clientDetail}>
          📞 {asset.primaryContactName || '—'} · {asset.primaryContactNumber || '—'}
        </Text>
      </View>

      {/* Work Approval status */}
      {task.workApproval?.status ? (
        <View style={srStyles.workApprovalBox}>
          <View style={[srStyles.workApprovalBadge, { backgroundColor: getWorkApprovalStyle(task.workApproval.status).bg }]}>
            <Text style={[srStyles.workApprovalBadgeText, { color: getWorkApprovalStyle(task.workApproval.status).text }]}>
              {getWorkApprovalStyle(task.workApproval.status).label}
            </Text>
          </View>
          {task.workApproval.requestedAt ? (
            <Text style={srStyles.workApprovalMeta}>
              Requested: {formatSrDateTime(task.workApproval.requestedAt)}
              {task.workApproval.requestedBy?.name ? ` by ${task.workApproval.requestedBy.name}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Assigned + Due */}
      {task.assignedAt ? (
        <Text style={srStyles.assignedText}>
          Assigned: {formatSrDateTime(task.assignedAt)}{' '}
          <Text style={srStyles.relativeOrange}>{assignedRel.label}</Text>
        </Text>
      ) : null}
      {task.dueDate ? (
        <Text style={srStyles.dueTextLine}>
          Due: {formatSrDate(task.dueDate)}{' '}
          <Text style={dueRel.isFuture ? srStyles.relativeGreen : srStyles.relativeRed}>
            {dueRel.label}
          </Text>
        </Text>
      ) : null}
      {task.updatedAt ? (
        <Text style={srStyles.dueTextLine}>
          Updated: {formatSrDateTime(task.updatedAt)}{' '}
          <Text style={srStyles.relativeGreen}>{updatedRel.label}</Text>
        </Text>
      ) : null}

      {errorMsg ? (
        <View style={srStyles.errorBox}>
          <Text style={srStyles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {effectiveStatus === 'ASSIGNED' && (
        <TouchableOpacity
          style={[srStyles.continueButton, isLoading && { opacity: 0.6 }]}
          onPress={onAccept}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={srStyles.continueButtonText}>Accept Task</Text>}
        </TouchableOpacity>
      )}

      {effectiveStatus === 'ACCEPTED' && (
        <TouchableOpacity
          style={[srStyles.continueButton, { backgroundColor: '#F26722' }, isLoading && { opacity: 0.6 }]}
          onPress={onStart}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={srStyles.continueButtonText}>Start</Text>}
        </TouchableOpacity>
      )}

      {effectiveStatus === 'IN_PROGRESS' && (
        <TouchableOpacity style={srStyles.continueButton} onPress={onContinue}>
          <Text style={srStyles.continueButtonText}>Continue →</Text>
        </TouchableOpacity>
      )}

      {(effectiveStatus === 'COMPLETED' || effectiveStatus === 'CLOSED') && (
        <TouchableOpacity style={srStyles.viewReportButton} onPress={onViewReport}>
          <Text style={srStyles.viewReportButtonText}>📄  View Report</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const srStyles = StyleSheet.create({
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  gensetNumber: {
    fontSize: 14,
    color: '#98A2B3',
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  categoryBadgeText: {
    color: '#1D4ED8',
    fontWeight: '600',
    fontSize: 12,
  },
  noCategoryBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  noCategoryBadgeText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  relativeRed: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 13,
  },
  relativeOrange: {
    color: '#F26722',
    fontWeight: '600',
    fontSize: 13,
  },
  relativeGreen: {
    color: '#16A34A',
    fontWeight: '600',
    fontSize: 13,
  },
  clientBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 15,
    padding: 14,
    marginTop: 14,
    gap: 6,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475467',
  },
  clientDetail: {
    fontSize: 14,
    color: '#667085',
  },
  workApprovalBox: {
    marginTop: 14,
  },
  workApprovalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  workApprovalBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  workApprovalMeta: {
    marginTop: 6,
    color: '#98A2B3',
    fontSize: 13,
  },
  assignedText: {
    marginTop: 14,
    color: '#475467',
    fontWeight: '500',
    fontSize: 14,
  },
  dueTextLine: {
    marginTop: 6,
    color: '#475467',
    fontWeight: '500',
    fontSize: 14,
  },
  continueButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  viewReportButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  viewReportButtonText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 15,
  },
});
