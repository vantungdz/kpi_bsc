package com.company.kpi.service.kpi;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.mapper.KpiAssignmentSnapshotMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiAssignmentSnapshotService {

    private final KpiAssignmentSnapshotMapper snapshotMapper;

    public void createSnapshotForAssignment(UUID assignmentId, UUID actorId) {
        if (assignmentId == null) {
            return;
        }
        snapshotMapper.insertSnapshotForAssignment(assignmentId, actorId);
    }

    public void createSnapshotsForInsertRows(Collection<KpiAssignmentInsertRow> rows, UUID actorId) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<UUID> assignmentIds = rows.stream()
                .filter(Objects::nonNull)
                .filter(row -> row.getUserId() != null)
                .map(KpiAssignmentInsertRow::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        createSnapshotsForAssignments(assignmentIds, actorId);
    }

    public void createSnapshotsForAssignmentEntities(Collection<KpiAssignment> assignments, UUID actorId) {
        if (assignments == null || assignments.isEmpty()) {
            return;
        }
        List<UUID> assignmentIds = assignments.stream()
                .filter(Objects::nonNull)
                .filter(assignment -> assignment.getUserId() != null)
                .map(KpiAssignment::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        createSnapshotsForAssignments(assignmentIds, actorId);
    }

    public void createSnapshotsForAssignments(Collection<UUID> assignmentIds, UUID actorId) {
        if (assignmentIds == null || assignmentIds.isEmpty()) {
            return;
        }
        List<UUID> ids = assignmentIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return;
        }
        snapshotMapper.insertSnapshotsForAssignments(ids, actorId);
    }
}
