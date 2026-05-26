package com.company.kpi.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApprovedMidYearSnapshotSupportTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void mergeSnapshotIfAbsent_preservesExistingFieldsAndAddsSnapshot() throws Exception {
        String existing =
                "{\"actual\":\"80%\",\"planActualRecords\":[{\"plan\":\"p1\",\"actual\":\"40%\"}],\"gmComment\":\"ok\"}";
        String merged =
                ApprovedMidYearSnapshotSupport.mergeSnapshotIfAbsent(
                        existing, new BigDecimal("3.0"), "2026-05-26T10:00:00+07:00");

        assertNotNull(merged);
        JsonNode root = JSON.readTree(merged);
        assertEquals("80%", root.get("actual").asText());
        assertTrue(root.get("planActualRecords").isArray());
        assertEquals("ok", root.get("gmComment").asText());

        JsonNode snap = root.get(ApprovedMidYearSnapshotSupport.SNAPSHOT_KEY);
        assertNotNull(snap);
        assertEquals(3.0, snap.get("selfScore").asDouble(), 0.001);
        assertEquals("80%", snap.get("actual").asText());
        assertEquals("2026-05-26T10:00:00+07:00", snap.get("capturedAt").asText());
    }

    @Test
    void mergeSnapshotIfAbsent_addsSnapshotWhenActualNull() throws Exception {
        String existing = "{\"note\":\"draft\"}";
        String merged =
                ApprovedMidYearSnapshotSupport.mergeSnapshotIfAbsent(
                        existing, new BigDecimal("4"), "2026-05-26T11:00:00+07:00");

        assertNotNull(merged);
        JsonNode root = JSON.readTree(merged);
        assertEquals("draft", root.get("note").asText());
        JsonNode snap = root.get(ApprovedMidYearSnapshotSupport.SNAPSHOT_KEY);
        assertNotNull(snap);
        assertEquals(4.0, snap.get("selfScore").asDouble(), 0.001);
        assertFalse(snap.has("actual"));
        assertNotNull(snap.get("capturedAt"));
    }

    @Test
    void mergeSnapshotIfAbsent_doesNotOverwriteExistingSnapshot() {
        String existing =
                "{\"approvedMidYearSnapshot\":{\"selfScore\":3,\"actual\":\"70%\",\"capturedAt\":\"x\"}}";
        assertTrue(ApprovedMidYearSnapshotSupport.hasSnapshot(existing));
        assertNull(
                ApprovedMidYearSnapshotSupport.mergeSnapshotIfAbsent(
                        existing, new BigDecimal("9"), "2026-05-26T12:00:00+07:00"));
    }

    @Test
    void mergePreservingSnapshot_copiesSnapshotWhenIncomingOmitsIt() throws Exception {
        String current =
                "{\"approvedMidYearSnapshot\":{\"selfScore\":3,\"actual\":\"70%\",\"capturedAt\":\"x\"},"
                        + "\"actual\":\"90%\"}";
        String incoming = "{\"actual\":\"95%\",\"planActualRecords\":[{\"plan\":\"p\",\"actual\":\"95%\"}]}";

        String merged = ApprovedMidYearSnapshotSupport.mergePreservingSnapshot(current, incoming);

        assertNotNull(merged);
        JsonNode root = JSON.readTree(merged);
        assertEquals("95%", root.get("actual").asText());
        JsonNode snap = root.get(ApprovedMidYearSnapshotSupport.SNAPSHOT_KEY);
        assertNotNull(snap);
        assertEquals(3.0, snap.get("selfScore").asDouble(), 0.001);
        assertEquals("70%", snap.get("actual").asText());
    }

    @Test
    void mergePreservingSnapshot_leavesIncomingWhenSnapshotAlreadyPresent() throws Exception {
        String current =
                "{\"approvedMidYearSnapshot\":{\"selfScore\":3,\"actual\":\"70%\",\"capturedAt\":\"x\"}}";
        String incoming =
                "{\"approvedMidYearSnapshot\":{\"selfScore\":9,\"actual\":\"99%\",\"capturedAt\":\"y\"},"
                        + "\"actual\":\"50%\"}";

        String merged = ApprovedMidYearSnapshotSupport.mergePreservingSnapshot(current, incoming);

        assertEquals(incoming, merged);
    }

    @Test
    void mergePreservingSnapshot_noOpWhenDbHasNoSnapshot() {
        String current = "{\"actual\":\"80%\"}";
        String incoming = "{\"actual\":\"90%\"}";
        assertEquals(incoming, ApprovedMidYearSnapshotSupport.mergePreservingSnapshot(current, incoming));
    }

    @Test
    void mergeSnapshotIfAbsent_wrapsNonObjectEvidences() throws Exception {
        String existing = "[{\"plan\":\"a\",\"actual\":\"1\"}]";
        String merged =
                ApprovedMidYearSnapshotSupport.mergeSnapshotIfAbsent(
                        existing, new BigDecimal("2.5"), "2026-05-26T13:00:00+07:00");

        assertNotNull(merged);
        JsonNode root = JSON.readTree(merged);
        assertTrue(root.has("_legacyEvidences"));
        assertNotNull(root.get(ApprovedMidYearSnapshotSupport.SNAPSHOT_KEY));
    }
}
