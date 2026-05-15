package com.company.kpi.service.pm;

import com.company.kpi.aggregate.PmMemberOptionAggregate;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.entity.KpiCategory;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.KpiMaster;
import com.company.kpi.entity.KpisInformation;
import com.company.kpi.entity.SysStatusCode;
import com.company.kpi.common.Constants;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCategoryMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.KpiMasterMapper;
import com.company.kpi.mapper.KpisInformationMapper;
import com.company.kpi.mapper.SysStatusCodeMapper;
import com.company.kpi.request.pm.KpiRegistrationRequest;
import com.company.kpi.response.pm.KpiRegistrationInitResponse;
import com.company.kpi.service.kpi.KpiAssignmentSnapshotService;

import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
public class KpiRegistrationService {

    private final KpiCycleMapper cycleMapper;
    private final KpiMasterMapper masterMapper;
    private final KpisInformationMapper infoMapper;
    private final KpiAssignmentMapper assignmentMapper;
    private final SysStatusCodeMapper sysStatusCodeMapper;
    private final KpiCategoryMapper categoryMapper;
    private final UserMapper userMapper;
    private final KpiAssignmentSnapshotService kpiAssignmentSnapshotService;
    
    // Inject các mapper thông qua constructor (Lombok @RequiredArgsConstructor cũng được)

    public KpiRegistrationService(KpiCycleMapper cycleMapper, KpiMasterMapper masterMapper,
                                  KpisInformationMapper infoMapper, KpiAssignmentMapper assignmentMapper,
                                  SysStatusCodeMapper sysStatusCodeMapper, KpiCategoryMapper categoryMapper,
                                  UserMapper userMapper,
                                  KpiAssignmentSnapshotService kpiAssignmentSnapshotService) {
        this.cycleMapper = cycleMapper;
        this.masterMapper = masterMapper;
        this.infoMapper = infoMapper;
        this.assignmentMapper = assignmentMapper;
        this.sysStatusCodeMapper = sysStatusCodeMapper;
        this.categoryMapper = categoryMapper;
        this.userMapper = userMapper;
        this.kpiAssignmentSnapshotService = kpiAssignmentSnapshotService;
    }

    public KpiRegistrationInitResponse getInitData(UUID currentUserId) {

        // Lần gọi DB 1: Lấy cycle hiện tại (Trả về đúng 1 object)
        KpiCycle activeCycle = cycleMapper.findActiveCycle(Constants.CycleStatus.OPEN);
        
        if (activeCycle == null) {
            throw new RuntimeException(Constants.Error.NO_ACTIVE_CYCLE);
        }

        // Lần gọi DB 2: Lấy danh sách thư viện KPI (Trả về List chứa 14 objects)
        List<KpiMaster> availableKpis = masterMapper.findAvailableKpis(currentUserId);

        // Lần gọi DB 3: Lấy toàn bộ sys status codes cho những category cần thiết
        List<SysStatusCode> allCodes = sysStatusCodeMapper.findByCategories(Arrays.asList(
            Constants.Category.KPI_TYPE, 
            Constants.Category.CALC_RULE, 
            Constants.Category.KPI_UNIT,
            Constants.Category.CALC_TYPE
        ));

        List<SysStatusCode> kpiTypes = allCodes.stream()
            .filter(c -> Constants.Category.KPI_TYPE.equals(c.getCategory()))
            .collect(Collectors.toList());

        List<SysStatusCode> calcRules = allCodes.stream()
            .filter(c -> Constants.Category.CALC_RULE.equals(c.getCategory()))
            .collect(Collectors.toList());

        List<SysStatusCode> calcTypes = allCodes.stream()
            .filter(c -> Constants.Category.CALC_TYPE.equals(c.getCategory()))
            .collect(Collectors.toList());

        List<SysStatusCode> units = allCodes.stream()
            .filter(c -> Constants.Category.KPI_UNIT.equals(c.getCategory()))
            .collect(Collectors.toList());

        // Lấy categories và team members
        List<KpiCategory> categories = categoryMapper.findAll();
        List<PmMemberOptionAggregate> teamMembersAgg = userMapper.findMembersByPmDepartment(currentUserId);
        log.info("Fetched: {}", teamMembersAgg);
        List<KpiRegistrationInitResponse.PmMemberOptionResponse> teamMembers = teamMembersAgg.stream()
            .filter(Objects::nonNull)
                .map(member -> {
                return KpiRegistrationInitResponse.PmMemberOptionResponse.builder()
                        .id(member.getId())
                        .shortName(member.getUsername())
                        .fullName(member.getFullName())
                        .departmentName(member.getDepartmentName())
                        .rankCode(member.getRankCode())
                        .build();
            }).toList();

        return KpiRegistrationInitResponse.builder()
            .activeCycle(activeCycle)
            .kpiLibrary(availableKpis)
            .kpiTypes(kpiTypes)
            .calcRules(calcRules)
            .calcTypes(calcTypes)
            .units(units)
            .categories(categories)
            .teamMembers(teamMembers)
            .build();
    }

    @Transactional
    public void registerKpi(KpiRegistrationRequest request, UUID currentUserId) {
        KpiCycle activeCycle = cycleMapper.findActiveCycle(Constants.CycleStatus.OPEN); // OPEN status
        if (activeCycle == null) {
            throw new RuntimeException(Constants.Error.NO_ACTIVE_CYCLE);
        }

        UUID masterKpiId = request.getExistingMasterKpiId();

        // 1. Nếu tự đề xuất KPI mới (Global = false)
        if (masterKpiId == null) {
            KpiMaster newMaster = new KpiMaster();
            newMaster.setId(UUID.randomUUID());
            newMaster.setName(request.getNewKpiName());
            newMaster.setTypeCode(request.getTypeCode());
            newMaster.setCalculationRuleCode(request.getCalculationRuleCode());
            newMaster.setUnitCode(request.getUnitCode());
            newMaster.setIsGlobal(false); //
            newMaster.setCreatedBy(currentUserId);
            
            masterMapper.insert(newMaster);
            masterKpiId = newMaster.getId();
        }

        // 2. Insert vào kpis_information cho chu kỳ hiện tại
        KpisInformation kpiInfo = infoMapper.findByCycleAndMaster(activeCycle.getId(), masterKpiId);
        if (kpiInfo == null) {
            kpiInfo = new KpisInformation();
            kpiInfo.setId(UUID.randomUUID());
            kpiInfo.setCycleId(activeCycle.getId());
            kpiInfo.setMasterKpiId(masterKpiId);
            kpiInfo.setTargetDescription(request.getTargetDescription());
            kpiInfo.setTargetValue(request.getTargetValue());
            kpiInfo.setWeight(request.getWeight());
            kpiInfo.setIsImportant(request.getIsImportant());
            kpiInfo.setCreatedBy(currentUserId);
            infoMapper.insert(kpiInfo);
        }

        // 3. Insert vào kpi_assignments (Trạng thái 402: WAITING_PM_APPROVAL)
        KpiAssignment assignment = new KpiAssignment();
        assignment.setId(UUID.randomUUID());
        assignment.setCycleId(activeCycle.getId()); // Partition key
        assignment.setKpiInfoId(kpiInfo.getId());
        assignment.setUserId(currentUserId);
        assignment.setTargetValue(request.getTargetValue());
        assignment.setStatusCode(Constants.AssignStatus.WAITING_PM_APPROVAL); //
        assignment.setCreatedBy(currentUserId);
        
        assignmentMapper.insert(assignment);
        kpiAssignmentSnapshotService.createSnapshotForAssignment(assignment.getId(), currentUserId);
    }
}
