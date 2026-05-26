package com.company.kpi.service.gm;

import com.company.kpi.aggregate.HubConfirmSnapshotSource;
import com.company.kpi.common.security.SensitiveDataCryptoService;
import com.company.kpi.mapper.GmEvaluationHubMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserKpiSummaryMapper;
import com.company.kpi.request.gm.GmEvaluationHubConfirmLine;
import com.company.kpi.request.gm.GmEvaluationHubConfirmRequest;
import com.company.kpi.util.ApprovedMidYearSnapshotSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GmEvaluationHubServiceSnapshotTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock
    private KpiCycleMapper kpiCycleMapper;
    @Mock
    private GmEvaluationHubMapper gmEvaluationHubMapper;
    @Mock
    private KpiAssignmentMapper kpiAssignmentMapper;
    @Mock
    private UserKpiSummaryMapper userKpiSummaryMapper;
    @Mock
    private SensitiveDataCryptoService sensitiveDataCryptoService;

    @InjectMocks
    private GmEvaluationHubService gmEvaluationHubService;

    private UUID cycleId;
    private UUID assignmentId;
    private UUID memberId;
    private UUID gmUserId;

    @BeforeEach
    void setUp() {
        cycleId = UUID.randomUUID();
        assignmentId = UUID.randomUUID();
        memberId = UUID.randomUUID();
        gmUserId = UUID.randomUUID();
    }

    @Test
    void confirm502_persistsApprovedMidYearSnapshotBeforeStatusUpdate() throws Exception {
        when(kpiCycleMapper.findById(cycleId)).thenReturn(Optional.of(new com.company.kpi.entity.KpiCycle()));
        when(kpiAssignmentMapper.selectHubConfirmStatus(assignmentId, cycleId, memberId)).thenReturn(502);

        HubConfirmSnapshotSource source = new HubConfirmSnapshotSource();
        source.setId(assignmentId);
        source.setCycleId(cycleId);
        source.setUserId(memberId);
        source.setStatusCode(502);
        source.setMidSelfScore(new BigDecimal("3"));
        source.setEvidences("{\"actual\":\"75%\"}");
        when(kpiAssignmentMapper.selectHubConfirmSnapshotSource(assignmentId, cycleId))
                .thenReturn(source);

        when(sensitiveDataCryptoService.decryptEvidenceSensitiveFields(any()))
                .thenAnswer(inv -> inv.getArgument(0));

        when(kpiAssignmentMapper.updateGmEvaluationHubConfirmReview502(
                        eq(assignmentId),
                        eq(cycleId),
                        eq(memberId),
                        eq(gmUserId),
                        eq(true),
                        any()))
                .thenReturn(1);

        GmEvaluationHubConfirmRequest req = new GmEvaluationHubConfirmRequest();
        req.setCycleId(cycleId);
        req.setEvaluationUserId(memberId);
        GmEvaluationHubConfirmLine line = new GmEvaluationHubConfirmLine();
        line.setAssignmentId(assignmentId);
        req.setLines(List.of(line));

        gmEvaluationHubService.confirmGmEvaluation(req, gmUserId);

        ArgumentCaptor<String> snapshotCaptor = ArgumentCaptor.forClass(String.class);
        verify(kpiAssignmentMapper)
                .updateGmEvaluationHubConfirmReview502(
                        eq(assignmentId),
                        eq(cycleId),
                        eq(memberId),
                        eq(gmUserId),
                        eq(true),
                        snapshotCaptor.capture());

        JsonNode snap = JSON.readTree(snapshotCaptor.getValue());
        assertEquals(3.0, snap.get("selfScore").asDouble(), 0.001);
        assertEquals("75%", snap.get("actual").asText());
        assertNotNull(snap.get("capturedAt"));
    }
}
