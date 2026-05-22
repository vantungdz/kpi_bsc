package com.company.kpi.service.gm;

import com.company.kpi.aggregate.report.GmReportAssignmentRow;
import com.company.kpi.mapper.GmReportMapper;
import com.company.kpi.mapper.PerformanceRatingScaleMapper;
import com.company.kpi.response.gm.GmRatingScaleLevelResponse;
import com.company.kpi.response.gm.report.GmReportComplianceResponse;
import com.company.kpi.response.gm.report.GmReportLevelDistributionResponse;
import com.company.kpi.response.gm.report.GmReportSectionAnalyticsResponse;
import com.company.kpi.response.gm.report.GmReportSectionBellCurveResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tổng hợp dữ liệu cho 4 báo cáo GM trên trang Reports.
 *
 * <p>Khung mức điểm lấy từ {@code performance_rating_levels} theo năm chu kỳ; nếu thiếu dữ liệu
 * thì fallback cấu hình mặc định (tương thích trước khi có DB).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GmReportService {

    private static final BigDecimal FALLBACK_TOP_THRESHOLD = new BigDecimal("3.41");

    private static final List<LevelDef> FALLBACK_LEVEL_DEFS = List.of(
            new LevelDef("NA", "<= 2.59 (N/A)", new BigDecimal("0"), new BigDecimal("2.59"), new BigDecimal("0"), false),
            new LevelDef("D", "2.60-2.99 (D)", new BigDecimal("2.60"), new BigDecimal("2.99"), new BigDecimal("0.5"), false),
            new LevelDef("C2", "3.00-3.10 (C2)", new BigDecimal("3.00"), new BigDecimal("3.10"), new BigDecimal("3.9"), false),
            new LevelDef("C1", "3.11-3.20 (C1)", new BigDecimal("3.11"), new BigDecimal("3.20"), new BigDecimal("5"), false),
            new LevelDef("B2", "3.21-3.30 (B2)", new BigDecimal("3.21"), new BigDecimal("3.30"), new BigDecimal("6.7"), false),
            new LevelDef("B1", "3.31-3.40 (B1)", new BigDecimal("3.31"), new BigDecimal("3.40"), new BigDecimal("8.4"), false),
            new LevelDef("A2", "3.41-3.50 (A2)", new BigDecimal("3.41"), new BigDecimal("3.50"), new BigDecimal("9.5"), true),
            new LevelDef("A1", "3.51-3.60 (A1)", new BigDecimal("3.51"), new BigDecimal("3.60"), new BigDecimal("11"), true),
            new LevelDef("O1", ">= 3.61 (O1)", new BigDecimal("3.61"), null, new BigDecimal("12.5"), true)
    );

    private final GmReportMapper gmReportMapper;
    private final PerformanceRatingScaleMapper performanceRatingScaleMapper;

    public GmReportLevelDistributionResponse getLevelDistribution(
            int primaryYear, List<Integer> compareYears, String sectionId) {

        List<Integer> years = mergeYears(primaryYear, compareYears);
        int scaleYear = newestYear(years);
        List<LevelDef> scale = resolveScaleForYear(scaleYear);

        List<GmReportAssignmentRow> rows = safeList(gmReportMapper.listAssignmentsByYears(years));

        if (sectionId != null && !"all".equalsIgnoreCase(sectionId) && !sectionId.isBlank()) {
            UUID sid = parseUuidSafely(sectionId);
            rows = rows.stream()
                    .filter(r -> sid != null && sid.equals(r.getSectionId()))
                    .collect(Collectors.toList());
        }

        Map<Integer, Map<UUID, BigDecimal>> scoreByYearByUser = scoresByYearAndUser(rows);

        List<GmReportLevelDistributionResponse.YearSeries> yearSeriesList = new ArrayList<>();
        for (Integer y : years) {
            Map<UUID, BigDecimal> userMap = scoreByYearByUser.getOrDefault(y, Map.of());
            List<Integer> counts = bucketize(userMap.values(), scale);
            GmReportLevelDistributionResponse.YearSeries ys = new GmReportLevelDistributionResponse.YearSeries();
            ys.setYear(y);
            ys.setCounts(counts);
            yearSeriesList.add(ys);
        }

        int detailYear = newestYear(years);
        List<GmReportLevelDistributionResponse.TopPerformer> tops =
                topPerformers(rows, detailYear, scale);

        GmReportLevelDistributionResponse out = new GmReportLevelDistributionResponse();
        out.setLevels(buildLevelDefs(scale));
        out.setScaleYear(scaleYear);
        out.setYears(yearSeriesList);
        out.setTopPerformers(tops);
        out.setTotalCount(scoreByYearByUser.getOrDefault(detailYear, Map.of()).size());
        return out;
    }

    public GmReportSectionBellCurveResponse getSectionBellCurve(int year) {
        List<LevelDef> scale = resolveScaleForYear(year);
        List<String> labels = scale.stream().map(LevelDef::label).toList();
        BigDecimal topThreshold = topTierMinThreshold(scale);

        List<GmReportAssignmentRow> rows = safeList(gmReportMapper.listAssignmentsByYears(List.of(year)));
        Map<UUID, BigDecimal> scoreByUserAll = perUserScore(rows);

        List<GmReportSectionBellCurveResponse.SectionSeries> seriesList = new ArrayList<>();

        GmReportSectionBellCurveResponse.SectionSeries allSeries = new GmReportSectionBellCurveResponse.SectionSeries();
        allSeries.setId("all");
        allSeries.setLabel("Toàn Công Ty");
        allSeries.setCounts(bucketize(scoreByUserAll.values(), scale));
        seriesList.add(allSeries);

        Map<UUID, List<GmReportAssignmentRow>> bySection = rows.stream()
                .filter(r -> r.getSectionId() != null)
                .collect(Collectors.groupingBy(GmReportAssignmentRow::getSectionId));

        Map<UUID, String> sectionNames = new LinkedHashMap<>();
        for (GmReportAssignmentRow r : rows) {
            if (r.getSectionId() != null && !sectionNames.containsKey(r.getSectionId())) {
                sectionNames.put(r.getSectionId(), r.getSectionName());
            }
        }

        for (Map.Entry<UUID, List<GmReportAssignmentRow>> e : bySection.entrySet()) {
            Map<UUID, BigDecimal> scoreByUser = perUserScore(e.getValue());
            GmReportSectionBellCurveResponse.SectionSeries s = new GmReportSectionBellCurveResponse.SectionSeries();
            s.setId(e.getKey().toString());
            s.setLabel(sectionNames.getOrDefault(e.getKey(), "Section"));
            s.setCounts(bucketize(scoreByUser.values(), scale));
            seriesList.add(s);
        }

        GmReportSectionBellCurveResponse.Summary summary = new GmReportSectionBellCurveResponse.Summary();
        summary.setAvgCompany(avg(scoreByUserAll.values()));
        summary.setTotalCount(scoreByUserAll.size());
        summary.setBestSectionName(bestSection(seriesList, true));
        summary.setWorstSectionName(bestSection(seriesList, false));
        long topCount = scoreByUserAll.values().stream()
                .filter(v -> v != null && v.compareTo(topThreshold) >= 0)
                .count();
        summary.setTopGroupCount((int) topCount);
        BigDecimal topPercent = scoreByUserAll.isEmpty()
                ? BigDecimal.ZERO
                : new BigDecimal(topCount).multiply(BigDecimal.valueOf(100))
                    .divide(new BigDecimal(scoreByUserAll.size()), 2, RoundingMode.HALF_UP);
        summary.setTopGroupPercent(topPercent);

        GmReportSectionBellCurveResponse out = new GmReportSectionBellCurveResponse();
        out.setLevelLabels(labels);
        out.setSections(seriesList);
        out.setSummary(summary);
        return out;
    }

    public GmReportSectionAnalyticsResponse getSectionAnalytics(int year) {
        List<GmReportAssignmentRow> rows = safeList(gmReportMapper.listAssignmentsByYears(List.of(year)));

        Map<UUID, List<GmReportAssignmentRow>> bySection = rows.stream()
                .filter(r -> r.getSectionId() != null)
                .collect(Collectors.groupingBy(GmReportAssignmentRow::getSectionId));
        Map<UUID, String> sectionNames = new LinkedHashMap<>();
        for (GmReportAssignmentRow r : rows) {
            if (r.getSectionId() != null && !sectionNames.containsKey(r.getSectionId())) {
                sectionNames.put(r.getSectionId(), r.getSectionName());
            }
        }
        List<GmReportSectionAnalyticsResponse.SectionScore> sectionAvgs = new ArrayList<>();
        for (Map.Entry<UUID, List<GmReportAssignmentRow>> e : bySection.entrySet()) {
            BigDecimal avgScore = avg(perUserScore(e.getValue()).values());
            GmReportSectionAnalyticsResponse.SectionScore ss = new GmReportSectionAnalyticsResponse.SectionScore();
            ss.setSectionId(e.getKey().toString());
            ss.setSectionName(sectionNames.getOrDefault(e.getKey(), "Section"));
            ss.setAverageScore(avgScore == null ? BigDecimal.ZERO : avgScore);
            sectionAvgs.add(ss);
        }
        sectionAvgs.sort((a, b) -> b.getAverageScore().compareTo(a.getAverageScore()));

        List<String> dimensions = rows.stream()
                .map(GmReportAssignmentRow::getCategoryName)
                .filter(n -> n != null && !n.isBlank())
                .distinct()
                .limit(6)
                .toList();

        GmReportSectionAnalyticsResponse.RadarSeries best = sectionAvgs.isEmpty() ? null
                : buildRadarSeries(rows, sectionAvgs.get(0).getSectionId(), sectionAvgs.get(0).getSectionName(), dimensions);
        GmReportSectionAnalyticsResponse.RadarSeries worst = sectionAvgs.size() < 2 ? null
                : buildRadarSeries(rows, sectionAvgs.get(sectionAvgs.size() - 1).getSectionId(),
                        sectionAvgs.get(sectionAvgs.size() - 1).getSectionName(), dimensions);

        GmReportSectionAnalyticsResponse.RadarPayload radar = new GmReportSectionAnalyticsResponse.RadarPayload();
        radar.setDimensions(dimensions);
        List<GmReportSectionAnalyticsResponse.RadarSeries> seriesList = new ArrayList<>();
        if (best != null) seriesList.add(best);
        if (worst != null) seriesList.add(worst);
        radar.setSeries(seriesList);

        GmReportSectionAnalyticsResponse out = new GmReportSectionAnalyticsResponse();
        out.setSectionAverages(sectionAvgs);
        out.setRadar(radar);
        return out;
    }

    public GmReportComplianceResponse getCompliance(int year) {
        List<GmReportAssignmentRow> rows = safeList(gmReportMapper.listBottleneckCandidates(year));

        int pendingApprovalUsers = 0;
        int missingEvidenceUsers = 0;
        List<GmReportComplianceResponse.Bottleneck> bottlenecks = new ArrayList<>();
        Set<UUID> seenBottleneckUserIds = new HashSet<>();
        for (GmReportAssignmentRow r : rows) {
            int sc = r.getStatusCode() == null ? 0 : r.getStatusCode();
            GmReportComplianceResponse.Bottleneck b = new GmReportComplianceResponse.Bottleneck();
            b.setUserId(r.getUserId() == null ? null : r.getUserId().toString());
            b.setFullName(r.getUserFullName());
            b.setRoleCode(r.getUserRoleCode());
            b.setSectionName(r.getSectionName());
            if (sc == 501 || sc == 601) {
                b.setReason("Member score awaiting approval");
                b.setSeverity("critical");
                b.setDelayLabel("Pending PM evaluation");
            } else if (sc == 502 || sc == 602) {
                b.setReason("Approved by PM — awaiting GM evaluation");
                b.setSeverity("warning");
                b.setDelayLabel("Pending GM evaluation");
            } else if ((sc == 404 || sc == 405) && r.getEvidenceFlag() == null) {
                b.setReason("No evidence submitted");
                b.setSeverity("warning");
                b.setDelayLabel("In progress");
            } else {
                continue;
            }
            UUID uid = r.getUserId();
            if (uid != null && !seenBottleneckUserIds.add(uid)) {
                continue;
            }
            bottlenecks.add(b);
            if (sc == 501 || sc == 502 || sc == 601 || sc == 602) {
                pendingApprovalUsers++;
            } else {
                missingEvidenceUsers++;
            }
        }
        int total = pendingApprovalUsers + missingEvidenceUsers;

        GmReportComplianceResponse.Status status = new GmReportComplianceResponse.Status();
        status.setPendingApproval(pendingApprovalUsers);
        status.setMissingEvidence(missingEvidenceUsers);
        status.setTotal(total);

        GmReportComplianceResponse out = new GmReportComplianceResponse();
        out.setStatus(status);
        out.setBottlenecks(bottlenecks);
        return out;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rating scale resolution
    // ─────────────────────────────────────────────────────────────────────────

    private List<LevelDef> resolveScaleForYear(int year) {
        List<GmRatingScaleLevelResponse> rows = performanceRatingScaleMapper.listLevelsByYear(year);
        if (rows == null || rows.isEmpty()) {
            log.debug("Reports: no rating scale for year {}, using fallback LEVEL_DEFS", year);
            return FALLBACK_LEVEL_DEFS;
        }
        List<LevelDef> scale = new ArrayList<>();
        for (GmRatingScaleLevelResponse row : rows) {
            scale.add(toLevelDef(row));
        }
        return scale;
    }

    private static LevelDef toLevelDef(GmRatingScaleLevelResponse row) {
        return new LevelDef(
                row.getLevelCode(),
                row.getLabel(),
                row.getMinScore(),
                row.getMaxScore(),
                row.getPitch() != null ? row.getPitch() : BigDecimal.ZERO,
                Boolean.TRUE.equals(row.getTopTier()));
    }

    private static int newestYear(List<Integer> years) {
        return years.stream().max(Comparator.naturalOrder()).orElse(years.isEmpty() ? 0 : years.get(0));
    }

    private static BigDecimal topTierMinThreshold(List<LevelDef> scale) {
        return scale.stream()
                .filter(LevelDef::topTier)
                .map(LevelDef::min)
                .min(Comparator.naturalOrder())
                .orElse(FALLBACK_TOP_THRESHOLD);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static <T> List<T> safeList(List<T> in) {
        return in == null ? new ArrayList<>() : in;
    }

    private static List<Integer> mergeYears(int primary, List<Integer> compare) {
        Map<Integer, Boolean> seen = new LinkedHashMap<>();
        seen.put(primary, true);
        if (compare != null) {
            for (Integer c : compare) {
                if (c != null) seen.put(c, true);
            }
        }
        return new ArrayList<>(seen.keySet());
    }

    private static UUID parseUuidSafely(String id) {
        try { return UUID.fromString(id); } catch (Exception ignore) { return null; }
    }

    private static Map<Integer, Map<UUID, BigDecimal>> scoresByYearAndUser(List<GmReportAssignmentRow> rows) {
        Map<Integer, Map<UUID, List<BigDecimal>>> bucket = new HashMap<>();
        for (GmReportAssignmentRow r : rows) {
            BigDecimal s = pickScore(r);
            if (s == null) continue;
            Integer y = r.getYear();
            UUID u = r.getUserId();
            if (y == null || u == null) continue;
            bucket.computeIfAbsent(y, k -> new HashMap<>())
                  .computeIfAbsent(u, k -> new ArrayList<>())
                  .add(s);
        }
        Map<Integer, Map<UUID, BigDecimal>> out = new HashMap<>();
        for (Map.Entry<Integer, Map<UUID, List<BigDecimal>>> e : bucket.entrySet()) {
            Map<UUID, BigDecimal> userMap = new HashMap<>();
            for (Map.Entry<UUID, List<BigDecimal>> u : e.getValue().entrySet()) {
                userMap.put(u.getKey(), avg(u.getValue()));
            }
            out.put(e.getKey(), userMap);
        }
        return out;
    }

    private static Map<UUID, BigDecimal> perUserScore(List<GmReportAssignmentRow> rows) {
        Map<UUID, List<BigDecimal>> bucket = new HashMap<>();
        for (GmReportAssignmentRow r : rows) {
            BigDecimal s = pickScore(r);
            if (s == null || r.getUserId() == null) continue;
            bucket.computeIfAbsent(r.getUserId(), k -> new ArrayList<>()).add(s);
        }
        Map<UUID, BigDecimal> out = new HashMap<>();
        for (Map.Entry<UUID, List<BigDecimal>> e : bucket.entrySet()) {
            out.put(e.getKey(), avg(e.getValue()));
        }
        return out;
    }

    private static BigDecimal pickScore(GmReportAssignmentRow r) {
        if (r.getEndGmScore() != null) return r.getEndGmScore();
        if (r.getEndPmScore() != null) return r.getEndPmScore();
        if (r.getEndSelfScore() != null) return r.getEndSelfScore();
        return r.getMidSelfScore();
    }

    private static BigDecimal avg(java.util.Collection<BigDecimal> values) {
        if (values == null || values.isEmpty()) return null;
        BigDecimal sum = BigDecimal.ZERO;
        int cnt = 0;
        for (BigDecimal v : values) {
            if (v == null) continue;
            sum = sum.add(v);
            cnt++;
        }
        if (cnt == 0) return null;
        return sum.divide(new BigDecimal(cnt), 2, RoundingMode.HALF_UP);
    }

    private static List<Integer> bucketize(java.util.Collection<BigDecimal> userScores, List<LevelDef> scale) {
        Integer[] counts = new Integer[scale.size()];
        Arrays.fill(counts, 0);
        if (userScores == null) return Arrays.asList(counts);
        for (BigDecimal s : userScores) {
            if (s == null) continue;
            int bucket = bucketIndex(s, scale);
            counts[bucket] = counts[bucket] + 1;
        }
        return Arrays.asList(counts);
    }

    private static int bucketIndex(BigDecimal s, List<LevelDef> scale) {
        for (int i = scale.size() - 1; i >= 0; i--) {
            LevelDef d = scale.get(i);
            if (s.compareTo(d.min()) >= 0) return i;
        }
        return 0;
    }

    private static List<GmReportLevelDistributionResponse.LevelDef> buildLevelDefs(List<LevelDef> scale) {
        List<GmReportLevelDistributionResponse.LevelDef> out = new ArrayList<>();
        for (LevelDef d : scale) {
            GmReportLevelDistributionResponse.LevelDef ld = new GmReportLevelDistributionResponse.LevelDef();
            ld.setCode(d.code());
            ld.setLabel(d.label());
            ld.setMin(d.min());
            ld.setMax(d.max());
            ld.setPitch(d.pitch());
            out.add(ld);
        }
        return out;
    }

    private static List<GmReportLevelDistributionResponse.TopPerformer> topPerformers(
            List<GmReportAssignmentRow> rows, int year, List<LevelDef> scale) {
        BigDecimal topThreshold = topTierMinThreshold(scale);
        Map<UUID, BigDecimal> scoreByUser = perUserScore(
                rows.stream().filter(r -> r.getYear() != null && r.getYear() == year).toList());
        Map<UUID, GmReportAssignmentRow> sample = new HashMap<>();
        for (GmReportAssignmentRow r : rows) {
            if (r.getYear() != null && r.getYear() == year) {
                sample.putIfAbsent(r.getUserId(), r);
            }
        }
        List<GmReportLevelDistributionResponse.TopPerformer> out = new ArrayList<>();
        scoreByUser.entrySet().stream()
                .filter(e -> e.getValue() != null && e.getValue().compareTo(topThreshold) >= 0)
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(10)
                .forEach(e -> {
                    GmReportAssignmentRow ref = sample.get(e.getKey());
                    if (ref == null) return;
                    GmReportLevelDistributionResponse.TopPerformer t = new GmReportLevelDistributionResponse.TopPerformer();
                    t.setUserId(e.getKey().toString());
                    t.setFullName(ref.getUserFullName());
                    t.setRoleCode(ref.getUserRoleCode());
                    t.setSectionName(ref.getSectionName());
                    t.setLevelCode(scale.get(bucketIndex(e.getValue(), scale)).code());
                    t.setScore(e.getValue());
                    out.add(t);
                });
        return out;
    }

    private static String bestSection(List<GmReportSectionBellCurveResponse.SectionSeries> series, boolean best) {
        String selected = null;
        BigDecimal bestVal = null;
        for (GmReportSectionBellCurveResponse.SectionSeries s : series) {
            if ("all".equals(s.getId())) continue;
            BigDecimal centroid = centroid(s.getCounts());
            if (centroid == null) continue;
            if (bestVal == null
                    || (best && centroid.compareTo(bestVal) > 0)
                    || (!best && centroid.compareTo(bestVal) < 0)) {
                bestVal = centroid;
                selected = s.getLabel();
            }
        }
        return selected == null ? "" : selected;
    }

    private static BigDecimal centroid(List<Integer> counts) {
        if (counts == null || counts.isEmpty()) return null;
        long total = 0;
        BigDecimal sum = BigDecimal.ZERO;
        for (int i = 0; i < counts.size(); i++) {
            int c = counts.get(i);
            total += c;
            sum = sum.add(BigDecimal.valueOf((long) c * i));
        }
        if (total == 0) return null;
        return sum.divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP);
    }

    private static GmReportSectionAnalyticsResponse.RadarSeries buildRadarSeries(
            List<GmReportAssignmentRow> rows, String sectionId, String sectionName, List<String> dimensions) {
        UUID sid = parseUuidSafely(sectionId);
        Map<String, List<BigDecimal>> bucket = new HashMap<>();
        for (GmReportAssignmentRow r : rows) {
            if (sid == null || !sid.equals(r.getSectionId())) continue;
            BigDecimal score = pickScore(r);
            String dim = r.getCategoryName();
            if (score == null || dim == null) continue;
            BigDecimal pct = score.multiply(BigDecimal.valueOf(20))
                    .min(BigDecimal.valueOf(100))
                    .max(BigDecimal.ZERO);
            bucket.computeIfAbsent(dim, k -> new ArrayList<>()).add(pct);
        }
        List<BigDecimal> data = new ArrayList<>();
        for (String d : dimensions) {
            BigDecimal avgScore = avg(bucket.getOrDefault(d, Collections.emptyList()));
            data.add(avgScore == null ? BigDecimal.ZERO : avgScore);
        }
        GmReportSectionAnalyticsResponse.RadarSeries s = new GmReportSectionAnalyticsResponse.RadarSeries();
        s.setSectionId(sectionId);
        s.setSectionName(sectionName);
        s.setData(data);
        return s;
    }

    private record LevelDef(
            String code,
            String label,
            BigDecimal min,
            BigDecimal max,
            BigDecimal pitch,
            boolean topTier) {}
}
