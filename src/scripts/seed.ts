import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { initializeDatabase, getRepository } from '../config/database';
import { User, Vehicle, Report, Case, Assignment, Disposal, Blacklist, Warning, Holiday } from '../entities';
import { UserRole, ReportSource, ReportStatus, ParkingType, CaseLevel, AssignmentStatus, DisposalAction, WarningType, HolidayType } from '../types/enums';

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const seedDatabase = async (): Promise<void> => {
  try {
    console.log('开始初始化数据库...');
    await initializeDatabase();

    const userRepository = getRepository(User);
    const vehicleRepository = getRepository(Vehicle);
    const reportRepository = getRepository(Report);
    const caseRepository = getRepository(Case);
    const assignmentRepository = getRepository(Assignment);
    const disposalRepository = getRepository(Disposal);
    const blacklistRepository = getRepository(Blacklist);
    const warningRepository = getRepository(Warning);
    const holidayRepository = getRepository(Holiday);

    console.log('清除现有数据...');
    await disposalRepository.clear();
    await assignmentRepository.clear();
    await reportRepository.clear();
    await caseRepository.clear();
    await blacklistRepository.clear();
    await warningRepository.clear();
    await vehicleRepository.clear();
    await userRepository.clear();
    await holidayRepository.clear();

    console.log('创建测试用户...');
    const usersData = [
      {
        username: 'admin',
        password: await hashPassword('admin123'),
        realName: '系统管理员',
        role: UserRole.ADMIN,
        department: '街道综治中心',
        phone: '13800138000',
      },
      {
        username: 'property',
        password: await hashPassword('property123'),
        realName: '张物业',
        role: UserRole.PROPERTY,
        department: '阳光社区物业',
        phone: '13800138001',
      },
      {
        username: 'chengguan',
        password: await hashPassword('chengguan123'),
        realName: '李城管',
        role: UserRole.CHENGGUAN,
        department: '街道城管中队',
        phone: '13800138002',
      },
      {
        username: 'police',
        password: await hashPassword('police123'),
        realName: '王交警',
        role: UserRole.TRAFFIC_POLICE,
        department: '交警支队',
        phone: '13800138003',
      },
      {
        username: 'grid',
        password: await hashPassword('grid123'),
        realName: '赵网格员',
        role: UserRole.GRID_WORKER,
        department: '阳光社区居委会',
        phone: '13800138004',
      },
    ];

    const users = await userRepository.save(usersData as any[]);
    console.log(`已创建 ${users.length} 个用户`);
    users.forEach(u => console.log(`  - ${u.realName} (${u.username}) 角色: ${u.role}, 密码: ${u.role}123`));

    console.log('\n创建测试车辆...');
    const vehiclesData = [
      { plateNumber: '京A12345', brand: '大众', model: '帕萨特', color: '黑色', ownerName: '张三', ownerPhone: '13900139001' },
      { plateNumber: '京B67890', brand: '丰田', model: '凯美瑞', color: '白色', ownerName: '李四', ownerPhone: '13900139002' },
      { plateNumber: '京C11111', brand: '本田', model: '雅阁', color: '银色', ownerName: '王五', ownerPhone: '13900139003' },
      { plateNumber: '京D22222', brand: '别克', model: '君威', color: '黑色', ownerName: '赵六', ownerPhone: '13900139004' },
      { plateNumber: '京E33333', brand: '奥迪', model: 'A6L', color: '黑色', ownerName: '钱七', ownerPhone: '13900139005' },
      { plateNumber: '京F44444', brand: '宝马', model: '5系', color: '白色', ownerName: '孙八', ownerPhone: '13900139006' },
      { plateNumber: '京G55555', brand: '奔驰', model: 'E级', color: '银色', ownerName: '周九', ownerPhone: '13900139007' },
      { plateNumber: '京H66666', brand: '现代', model: '索纳塔', color: '黑色', ownerName: '吴十', ownerPhone: '13900139008' },
    ];

    const vehicles = await vehicleRepository.save(vehiclesData as any[]);
    console.log(`已创建 ${vehicles.length} 辆车`);

    console.log('\n创建测试举报和案件...');
    const now = dayjs();
    const reportsData = [
      {
        source: ReportSource.RESIDENT,
        plateNumber: '京A12345',
        location: '阳光路123号门前',
        roadSection: '阳光路',
        parkingType: ParkingType.ROADSIDE,
        firstSeenAt: now.subtract(45, 'day').toDate(),
        overtimeDays: 45,
        description: '僵尸车长期占用公共停车位',
        reporterName: '居民陈先生',
        reporterPhone: '13700137001',
        vehicleId: vehicles[0].id,
      },
      {
        source: ReportSource.PROPERTY,
        plateNumber: '京A12345',
        location: '阳光路125号门前',
        roadSection: '阳光路',
        parkingType: ParkingType.ROADSIDE,
        firstSeenAt: now.subtract(40, 'day').toDate(),
        overtimeDays: 40,
        description: '同一车辆多次被居民多次举报',
        reporterName: '张物业',
        reporterPhone: '13800138001',
        vehicleId: vehicles[0].id,
        reporterId: users[1].id,
      },
      {
        source: ReportSource.PATROL,
        plateNumber: '京B67890',
        location: '和平街45号路边',
        roadSection: '和平街',
        parkingType: ParkingType.ROADSIDE,
        firstSeenAt: now.subtract(20, 'day').toDate(),
        overtimeDays: 20,
        description: '巡查发现的僵尸车',
        reporterName: '李城管',
        reporterPhone: '13800138002',
        vehicleId: vehicles[1].id,
        reporterId: users[2].id,
      },
      {
        source: ReportSource.RESIDENT,
        plateNumber: '京C11111',
        location: '幸福小区地下车库B1层012车位',
        roadSection: '幸福路',
        parkingType: ParkingType.UNDERGROUND,
        firstSeenAt: now.subtract(60, 'day').toDate(),
        overtimeDays: 60,
        description: '小区地下车库僵尸车',
        reporterName: '居民刘女士',
        reporterPhone: '13700137002',
        vehicleId: vehicles[2].id,
      },
      {
        source: ReportSource.PATROL,
        plateNumber: '京D22222',
        location: '人民路公共停车场A区008车位',
        roadSection: '人民路',
        parkingType: ParkingType.PUBLIC,
        firstSeenAt: now.subtract(10, 'day').toDate(),
        overtimeDays: 10,
        description: '公共停车场僵尸车',
        reporterName: '赵网格员',
        reporterPhone: '13800138004',
        vehicleId: vehicles[3].id,
        reporterId: users[4].id,
      },
      {
        source: ReportSource.RESIDENT,
        plateNumber: '京E33333',
        location: '文明路78号门前',
        roadSection: '文明路',
        parkingType: ParkingType.ROADSIDE,
        firstSeenAt: now.subtract(90, 'day').toDate(),
        overtimeDays: 90,
        description: '严重超时僵尸车',
        reporterName: '居民孙先生',
        reporterPhone: '13700137003',
        vehicleId: vehicles[4].id,
      },
      {
        source: ReportSource.TOW_RESULT,
        plateNumber: '京F44444',
        location: '和谐街100号路边',
        roadSection: '和谐街',
        parkingType: ParkingType.ROADSIDE,
        firstSeenAt: now.subtract(5, 'day').toDate(),
        overtimeDays: 5,
        description: '已拖移车辆',
        reporterName: '王交警',
        reporterPhone: '13800138003',
        vehicleId: vehicles[5].id,
        reporterId: users[3].id,
      },
    ];

    const reports = await reportRepository.save(reportsData as any[]);
    console.log(`已创建 ${reports.length} 条举报记录`);

    console.log('\n创建测试案件...');
    const casesData = [
      {
        caseNumber: `CASE-${now.format('YYYYMMDD')}-0001`,
        plateNumber: '京A12345',
        location: '阳光路123号门前',
        roadSection: '阳光路',
        parkingType: ParkingType.ROADSIDE,
        level: CaseLevel.LEVEL_3,
        status: ReportStatus.PROCESSING,
        firstSeenAt: now.subtract(45, 'day').toDate(),
        totalOvertimeDays: 45,
        vehicleId: vehicles[0].id,
        description: '多次举报的僵尸车',
        isBlacklisted: false,
        reportCount: 2,
        remindCount: 2,
        currentAssigneeId: users[1].id,
        currentDepartment: '阳光社区物业',
      },
      {
        caseNumber: `CASE-${now.format('YYYYMMDD')}-0002`,
        plateNumber: '京B67890',
        location: '和平街45号路边',
        roadSection: '和平街',
        parkingType: ParkingType.ROADSIDE,
        level: CaseLevel.LEVEL_2,
        status: ReportStatus.PENDING,
        firstSeenAt: now.subtract(20, 'day').toDate(),
        totalOvertimeDays: 20,
        vehicleId: vehicles[1].id,
        description: '新发现的僵尸车',
        isBlacklisted: false,
        reportCount: 1,
        remindCount: 0,
      },
      {
        caseNumber: `CASE-${now.format('YYYYMMDD')}-0003`,
        plateNumber: '京C11111',
        location: '幸福小区地下车库B1层012车位',
        roadSection: '幸福路',
        parkingType: ParkingType.UNDERGROUND,
        level: CaseLevel.LEVEL_4,
        status: ReportStatus.ESCALATED,
        firstSeenAt: now.subtract(60, 'day').toDate(),
        totalOvertimeDays: 60,
        vehicleId: vehicles[2].id,
        description: '严重超时僵尸车',
        isBlacklisted: true,
        reportCount: 1,
        remindCount: 3,
        currentAssigneeId: users[2].id,
        currentDepartment: '街道城管中队',
      },
      {
        caseNumber: `CASE-${now.format('YYYYMMDD')}-0004`,
        plateNumber: '京D22222',
        location: '人民路公共停车场A区008车位',
        roadSection: '人民路',
        parkingType: ParkingType.PUBLIC,
        level: CaseLevel.LEVEL_1,
        status: ReportStatus.PENDING,
        firstSeenAt: now.subtract(10, 'day').toDate(),
        totalOvertimeDays: 10,
        vehicleId: vehicles[3].id,
        description: '轻微超时车辆',
        isBlacklisted: false,
        reportCount: 1,
        remindCount: 0,
      },
      {
        caseNumber: `CASE-${now.format('YYYYMMDD')}-0005`,
        plateNumber: '京E33333',
        location: '文明路78号门前',
        roadSection: '文明路',
        parkingType: ParkingType.ROADSIDE,
        level: CaseLevel.LEVEL_4,
        status: ReportStatus.RESOLVED,
        firstSeenAt: now.subtract(90, 'day').toDate(),
        totalOvertimeDays: 90,
        vehicleId: vehicles[4].id,
        description: '已处理完成的案件',
        isBlacklisted: true,
        reportCount: 1,
        remindCount: 5,
        resolvedAt: now.subtract(2, 'day').toDate(),
      },
    ];

    const cases = await caseRepository.save(casesData as any[]);
    console.log(`已创建 ${cases.length} 个案件`);

    console.log('\n更新举报关联案件...');
    reports[0].caseId = cases[0].id;
    reports[1].caseId = cases[0].id;
    reports[1].isMerged = true;
    reports[1].mergeRemark = '自动合并：同一车辆相近位置';
    reports[2].caseId = cases[1].id;
    reports[3].caseId = cases[2].id;
    reports[4].caseId = cases[3].id;
    reports[5].caseId = cases[4].id;
    await reportRepository.save(reports);

    console.log('\n创建测试分派记录...');
    const assignmentsData = [
      {
        caseId: cases[0].id,
        targetRole: UserRole.PROPERTY,
        targetDepartment: '阳光社区物业',
        assigneeId: users[1].id,
        assignerId: users[0].id,
        assignRemark: '请尽快处理',
        deadline: now.add(3, 'day').toDate(),
        urgencyLevel: CaseLevel.LEVEL_3,
        status: AssignmentStatus.IN_PROGRESS,
        isEscalation: false,
      },
      {
        caseId: cases[2].id,
        targetRole: UserRole.PROPERTY,
        targetDepartment: '幸福社区物业',
        assigneeId: users[1].id,
        assignerId: users[0].id,
        assignRemark: '多次催挪无效，首次分派',
        deadline: now.add(7, 'day').toDate(),
        urgencyLevel: CaseLevel.LEVEL_3,
        status: AssignmentStatus.ESCALATED,
        isEscalation: false,
      },
      {
        caseId: cases[2].id,
        targetRole: UserRole.CHENGGUAN,
        targetDepartment: '街道城管中队',
        assigneeId: users[2].id,
        assignerId: users[0].id,
        assignRemark: '物业处理无效，升级至城管',
        deadline: now.add(5, 'day').toDate(),
        urgencyLevel: CaseLevel.LEVEL_4,
        status: AssignmentStatus.IN_PROGRESS,
        isEscalation: true,
        fromAssignmentId: 2,
      },
    ];

    const assignments = await assignmentRepository.save(assignmentsData as any[]);
    console.log(`已创建 ${assignments.length} 条分派记录`);

    console.log('\n创建测试处置记录...');
    const disposalsData = [
      {
        caseId: cases[0].id,
        action: DisposalAction.NOTICE,
        result: '已张贴挪车通知书',
        remark: '第一次通知',
        operatorId: users[1].id,
      },
      {
        caseId: cases[0].id,
        action: DisposalAction.REMIND,
        result: '电话催促车主挪车',
        remark: '车主称近期挪车',
        operatorId: users[1].id,
      },
      {
        caseId: cases[2].id,
        action: DisposalAction.NOTICE,
        result: '已张贴挪车通知书',
        remark: '第一次通知',
        operatorId: users[1].id,
      },
      {
        caseId: cases[2].id,
        action: DisposalAction.REMIND,
        result: '电话催促，车主拒绝挪车',
        remark: '车主态度强硬',
        operatorId: users[1].id,
      },
      {
        caseId: cases[2].id,
        action: DisposalAction.REMIND,
        result: '再次电话催促',
        remark: '第三次催促',
        operatorId: users[1].id,
      },
      {
        caseId: cases[4].id,
        action: DisposalAction.WARNING,
        result: '已开具警告单',
        remark: '正式警告',
        operatorId: users[2].id,
      },
      {
        caseId: cases[4].id,
        action: DisposalAction.TOW,
        result: '已拖移至指定停车场',
        remark: '拖移完成',
        operatorId: users[3].id,
      },
    ];

    const disposals = await disposalRepository.save(disposalsData as any[]);
    console.log(`已创建 ${disposals.length} 条处置记录`);

    console.log('\n创建黑名单记录...');
    const blacklistData = [
      {
        vehicleId: vehicles[2].id,
        plateNumber: vehicles[2].plateNumber,
        reason: '累计超时60天以上',
        addedAt: now.subtract(1, 'day').toDate(),
        isActive: true,
        totalViolations: 1,
        totalOvertimeDays: 60,
      },
      {
        vehicleId: vehicles[4].id,
        plateNumber: vehicles[4].plateNumber,
        reason: '累计超时90天以上',
        addedAt: now.subtract(3, 'day').toDate(),
        isActive: true,
        totalViolations: 1,
        totalOvertimeDays: 90,
      },
    ];

    const blacklists = await blacklistRepository.save(blacklistData as any[]);
    console.log(`已创建 ${blacklists.length} 条黑名单记录`);

    console.log('\n创建预警记录...');
    const warningsData = [
      {
        type: WarningType.OVERTIME,
        title: '超时预警',
        content: '车辆京A12345超时45天未处理',
        plateNumber: '京A12345',
        location: '阳光路123号门前',
        roadSection: '阳光路',
        level: CaseLevel.LEVEL_3,
        relatedCaseId: cases[0].id,
        isConfirmed: false,
      },
      {
        type: WarningType.BLACKLIST,
        title: '黑名单车辆预警',
        content: '黑名单车辆京C11111再次出现',
        plateNumber: '京C11111',
        location: '幸福小区地下车库',
        roadSection: '幸福路',
        level: CaseLevel.LEVEL_4,
        relatedCaseId: cases[2].id,
        isConfirmed: true,
        confirmedAt: now.subtract(1, 'day').toDate(),
        confirmedBy: users[0].id,
      },
      {
        type: WarningType.HOTSPOT,
        title: '热点区域预警',
        content: '阳光路近期举报较多',
        location: '阳光路',
        roadSection: '阳光路',
        level: CaseLevel.LEVEL_2,
        isConfirmed: false,
      },
    ];

    const warnings = await warningRepository.save(warningsData as any[]);
    console.log(`已创建 ${warnings.length} 条预警记录`);

    console.log('\n创建节假日数据...');
    const holidaysData = [
      {
        name: '2025年春节',
        type: HolidayType.SPRING_FESTIVAL,
        startDate: now.add(1, 'month').toDate(),
        endDate: now.add(1, 'month').add(7, 'day').toDate(),
        isSpecialCleanup: true,
        description: '春节期间僵尸车专项清理行动',
      },
      {
        name: '2025年国庆节',
        type: HolidayType.NATIONAL_DAY,
        startDate: now.add(9, 'month').toDate(),
        endDate: now.add(9, 'month').add(7, 'day').toDate(),
        isSpecialCleanup: true,
        description: '国庆期间停车秩序专项整治',
      },
    ];

    const holidays = await holidayRepository.save(holidaysData as any[]);
    console.log(`已创建 ${holidays.length} 条节假日记录`);

    console.log('\n✅ 数据初始化完成！');
    console.log('\n默认账号信息:');
    console.log('  管理员: admin / admin123');
    console.log('  物业: property / property123');
    console.log('  城管: chengguan / chengguan123');
    console.log('  交警: police / police123');
    console.log('  网格员: grid / grid123');

    process.exit(0);
  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
};

seedDatabase();
