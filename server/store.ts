import { hashPassword } from './auth';
import type {
  AcademyEvent,
  Announcement,
  AppNotification,
  AppRole,
  AttendanceRecord,
  AuditLog,
  Branch,
  Coach,
  CommunityPost,
  DelegatePermissionKey,
  DelegateRecord,
  MediaItem,
  ParentRecord,
  PaymentRecord,
  Player,
  Sport,
  SubscriptionRecord,
  TrainingGroup,
} from '../src/types/xo';

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: AppRole;
  passwordHash: string;
  isActive: boolean;
  assignedBranchIds: string[];
  delegatePermissions: Array<{ branchId: string; permission: DelegatePermissionKey }>;
  assignedGroupIds: string[];
  linkedPlayerIds: string[];
}

export interface StoredResetToken {
  email: string;
  code: string;
  expiresAt: number;
}

export interface StoreState {
  users: StoredUser[];
  branches: Branch[];
  sports: Sport[];
  coaches: Coach[];
  groups: TrainingGroup[];
  delegates: DelegateRecord[];
  parents: ParentRecord[];
  players: Player[];
  attendance: AttendanceRecord[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
  announcements: Announcement[];
  posts: CommunityPost[];
  postLikes: Record<string, string[]>;
  media: MediaItem[];
  events: AcademyEvent[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  resetTokens: StoredResetToken[];
  uploadedFiles: Map<string, { buffer: Buffer; mimeType: string; fileName: string }>;
}

function createInitialState(): StoreState {
  // Ephemeral boot hash for seeded fictional accounts; real users set their own passwords on register/reset.
  const bootHash = hashPassword(`fictional_boot_${Date.now()}_${Math.random()}`);

  const users: StoredUser[] = [
    {
      id: 'user_owner_1',
      fullName: 'كابتن عمر المنصور',
      email: 'owner@xo-academy.example',
      phone: '01001112233',
      role: 'OWNER',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: ['branch_gamal', 'branch_khalil'],
      delegatePermissions: [],
      assignedGroupIds: [],
      linkedPlayerIds: [],
    },
    {
      id: 'user_delegate_1',
      fullName: 'أ. سلمى مصطفى',
      email: 'delegate.gamal@xo-academy.example',
      phone: '01002223344',
      role: 'DELEGATE',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: ['branch_gamal'],
      delegatePermissions: [
        { branchId: 'branch_gamal', permission: 'manage_players' },
        { branchId: 'branch_gamal', permission: 'manage_attendance' },
        { branchId: 'branch_gamal', permission: 'manage_payments' },
        { branchId: 'branch_gamal', permission: 'view_reports' },
      ],
      assignedGroupIds: [],
      linkedPlayerIds: [],
    },
    {
      id: 'user_coach_1',
      fullName: 'كابتن كريم السعدني',
      email: 'coach.karim@xo-academy.example',
      phone: '01003334455',
      role: 'COACH',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: ['branch_gamal'],
      delegatePermissions: [],
      assignedGroupIds: ['grp_parkour_gamal'],
      linkedPlayerIds: [],
    },
    {
      id: 'user_coach_2',
      fullName: 'كابتن سارة المهدي',
      email: 'coach.sara@xo-academy.example',
      phone: '01004445566',
      role: 'COACH',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: ['branch_khalil'],
      delegatePermissions: [],
      assignedGroupIds: ['grp_gymnastics_khalil', 'grp_tkd_khalil'],
      linkedPlayerIds: [],
    },
    {
      id: 'user_parent_1',
      fullName: 'أ. منى عبد الرحمن',
      email: 'parent.mona@xo-academy.example',
      phone: '01005556677',
      role: 'PARENT',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: [],
      delegatePermissions: [],
      assignedGroupIds: [],
      linkedPlayerIds: ['plr_101', 'plr_102'],
    },
    {
      id: 'user_parent_2',
      fullName: 'أ. طارق فؤاد',
      email: 'parent.tarek@xo-academy.example',
      phone: '01006667788',
      role: 'PARENT',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: [],
      delegatePermissions: [],
      assignedGroupIds: [],
      linkedPlayerIds: ['plr_103'],
    },
    {
      id: 'user_player_1',
      fullName: 'يوسف أحمد (لاعب)',
      email: 'player.youssef@xo-academy.example',
      phone: '01007778899',
      role: 'PLAYER',
      passwordHash: bootHash,
      isActive: true,
      assignedBranchIds: ['branch_gamal'],
      delegatePermissions: [],
      assignedGroupIds: ['grp_parkour_gamal'],
      linkedPlayerIds: ['plr_101'],
    },
  ];

  const branches: Branch[] = [
    {
      id: 'branch_gamal',
      nameAr: 'ميامي — جمال عبد الناصر',
      addressAr: 'شارع جمال عبد الناصر الرئيسي، ميامي، الإسكندرية',
      phone: '01000001001',
      isActive: true,
    },
    {
      id: 'branch_khalil',
      nameAr: 'ميامي — خليل حمادة',
      addressAr: 'شارع خليل حمادة، ميامي، الإسكندرية',
      phone: '01000001002',
      isActive: true,
    },
  ];

  const sports: Sport[] = [
    {
      id: 'sport_parkour',
      nameAr: 'الباركور',
      slug: 'parkour',
      descriptionAr: 'تطوير الرشاقة، التوازن، والقوة الوظيفية وتخطي الحواجز بأسلوب آمن واحترافي.',
      monthlyFeeEgp: 850,
      imageUrl: '/src/assets/images/sport_parkour_1795470265155.jpg',
      isActive: true,
    },
    {
      id: 'sport_kickboxing',
      nameAr: 'الكيك بوكسينج',
      slug: 'kickboxing',
      descriptionAr: 'تدريب قتالي متكامل لبناء التحمل والسرعة والدفاع عن النفس.',
      monthlyFeeEgp: 800,
      imageUrl: '/src/assets/images/sport_combat_mma_1795470264712.jpg',
      isActive: true,
    },
    {
      id: 'sport_mma',
      nameAr: 'الفنون القتالية المختلطة (MMA)',
      slug: 'mma',
      descriptionAr: 'برامج تأسيسية ومتقدمة تجمع بين القتال الواقف والأرضي واللياقة العالية.',
      monthlyFeeEgp: 950,
      imageUrl: '/src/assets/images/sport_combat_mma_1795470264712.jpg',
      isActive: true,
    },
    {
      id: 'sport_gymnastics',
      nameAr: 'الجمباز',
      slug: 'gymnastics',
      descriptionAr: 'تأسيس المرونة والتوافق العضلي العصبي والأداء الحركي للأبطال الناشئين.',
      monthlyFeeEgp: 900,
      imageUrl: '/src/assets/images/sport_gymnastics_tkd_1795470265893.jpg',
      isActive: true,
    },
    {
      id: 'sport_taekwondo',
      nameAr: 'التايكوندو',
      slug: 'taekwondo',
      descriptionAr: 'انضباط، اختبارات أحزمة معتمدة، ومهارات ركل عالية الدقة.',
      monthlyFeeEgp: 750,
      imageUrl: '/src/assets/images/sport_gymnastics_tkd_1795470265893.jpg',
      isActive: true,
    },
  ];

  const coaches: Coach[] = [
    {
      id: 'coach_1',
      userId: 'user_coach_1',
      fullName: 'كابتن كريم السعدني',
      specialtySportId: 'sport_parkour',
      primaryBranchId: 'branch_gamal',
      bioAr: 'مدرب معتمد في الباركور والحركة الحرة بخبرة 8 سنوات في تدريب الناشئين.',
      assignedGroupIds: ['grp_parkour_gamal'],
      isActive: true,
    },
    {
      id: 'coach_2',
      userId: 'user_coach_2',
      fullName: 'كابتن سارة المهدي',
      specialtySportId: 'sport_gymnastics',
      primaryBranchId: 'branch_khalil',
      bioAr: 'بطلة جمهورية سابقة في الجمباز الفني ومدربة تايكوندو معتمدة.',
      assignedGroupIds: ['grp_gymnastics_khalil', 'grp_tkd_khalil'],
      isActive: true,
    },
    {
      id: 'coach_3',
      fullName: 'كابتن أحمد شريف',
      specialtySportId: 'sport_kickboxing',
      primaryBranchId: 'branch_gamal',
      bioAr: 'مدرب كيك بوكسينج وMMA متخصص في تأهيل البطولات القتالية.',
      assignedGroupIds: ['grp_kickboxing_gamal', 'grp_mma_gamal'],
      isActive: true,
    },
  ];

  const groups: TrainingGroup[] = [
    {
      id: 'grp_parkour_gamal',
      nameAr: 'أبطال الباركور — المستوى التأسيسي',
      branchId: 'branch_gamal',
      sportId: 'sport_parkour',
      ageRange: '8 - 13 سنة',
      scheduleDays: 'الأحد · الثلاثاء · الخميس',
      scheduleTime: '05:00 م - 06:15 م',
      maxCapacity: 18,
      coachIds: ['coach_1'],
      isActive: true,
    },
    {
      id: 'grp_kickboxing_gamal',
      nameAr: 'صقور الكيك بوكسينج — ناشئين',
      branchId: 'branch_gamal',
      sportId: 'sport_kickboxing',
      ageRange: '10 - 15 سنة',
      scheduleDays: 'السبت · الإثنين · الأربعاء',
      scheduleTime: '06:30 م - 07:45 م',
      maxCapacity: 20,
      coachIds: ['coach_3'],
      isActive: true,
    },
    {
      id: 'grp_mma_gamal',
      nameAr: 'فريق MMA المتقدم',
      branchId: 'branch_gamal',
      sportId: 'sport_mma',
      ageRange: '13 - 17 سنة',
      scheduleDays: 'السبت · الإثنين · الأربعاء',
      scheduleTime: '08:00 م - 09:30 م',
      maxCapacity: 16,
      coachIds: ['coach_3'],
      isActive: true,
    },
    {
      id: 'grp_gymnastics_khalil',
      nameAr: 'براعم الجمباز الفني',
      branchId: 'branch_khalil',
      sportId: 'sport_gymnastics',
      ageRange: '6 - 11 سنة',
      scheduleDays: 'الأحد · الثلاثاء · الخميس',
      scheduleTime: '04:30 م - 05:45 م',
      maxCapacity: 15,
      coachIds: ['coach_2'],
      isActive: true,
    },
    {
      id: 'grp_tkd_khalil',
      nameAr: 'نخبة التايكوندو — أحزمة ملونة',
      branchId: 'branch_khalil',
      sportId: 'sport_taekwondo',
      ageRange: '9 - 14 سنة',
      scheduleDays: 'السبت · الإثنين · الأربعاء',
      scheduleTime: '05:30 م - 06:45 م',
      maxCapacity: 22,
      coachIds: ['coach_2'],
      isActive: true,
    },
  ];

  const delegates: DelegateRecord[] = [
    {
      id: 'del_1',
      userId: 'user_delegate_1',
      fullName: 'أ. سلمى مصطفى',
      email: 'delegate.gamal@xo-academy.example',
      assignedBranchIds: ['branch_gamal'],
      permissions: [
        { branchId: 'branch_gamal', permission: 'manage_players' },
        { branchId: 'branch_gamal', permission: 'manage_attendance' },
        { branchId: 'branch_gamal', permission: 'manage_payments' },
        { branchId: 'branch_gamal', permission: 'view_reports' },
      ],
      isActive: true,
    },
  ];

  const parents: ParentRecord[] = [
    {
      id: 'par_1',
      userId: 'user_parent_1',
      fullName: 'أ. منى عبد الرحمن',
      phone: '01005556677',
      email: 'parent.mona@xo-academy.example',
      emergencyContact: '01009998811',
      playerIds: ['plr_101', 'plr_102'],
    },
    {
      id: 'par_2',
      userId: 'user_parent_2',
      fullName: 'أ. طارق فؤاد',
      phone: '01006667788',
      email: 'parent.tarek@xo-academy.example',
      emergencyContact: '01008887722',
      playerIds: ['plr_103'],
    },
  ];

  const players: Player[] = [
    {
      id: 'plr_101',
      userId: 'user_player_1',
      playerCode: 'XO-26-101',
      fullName: 'يوسف أحمد علي',
      birthDate: '2014-05-12',
      photoUrl: '/src/assets/images/sport_parkour_1795470265155.jpg',
      branchId: 'branch_gamal',
      sportId: 'sport_parkour',
      groupId: 'grp_parkour_gamal',
      beltOrLevel: 'المستوى الثاني — قفز متقدم',
      performanceScore: 88,
      coachNotes: 'تطور ملحوظ في الهبوط الآمن والتوازن على الحواجز المرتفعة.',
      medicalNotes: 'لا توجد ملاحظات طبية.',
      parentIds: ['par_1'],
      parentNames: ['أ. منى عبد الرحمن'],
      isActive: true,
    },
    {
      id: 'plr_102',
      playerCode: 'XO-26-102',
      fullName: 'مريم أحمد علي',
      birthDate: '2016-09-21',
      photoUrl: '/src/assets/images/sport_gymnastics_tkd_1795470265893.jpg',
      branchId: 'branch_khalil',
      sportId: 'sport_gymnastics',
      groupId: 'grp_gymnastics_khalil',
      beltOrLevel: 'براعم المستوى الأول',
      performanceScore: 91,
      coachNotes: 'مرونة ممتازة والتزام رائع بتعليمات الإحماء.',
      medicalNotes: 'لا توجد ملاحظات طبية.',
      parentIds: ['par_1'],
      parentNames: ['أ. منى عبد الرحمن'],
      isActive: true,
    },
    {
      id: 'plr_103',
      playerCode: 'XO-26-103',
      fullName: 'حمزة طارق فؤاد',
      birthDate: '2013-02-10',
      photoUrl: '/src/assets/images/sport_combat_mma_1795470264712.jpg',
      branchId: 'branch_gamal',
      sportId: 'sport_kickboxing',
      groupId: 'grp_kickboxing_gamal',
      beltOrLevel: 'حزام برتقالي',
      performanceScore: 84,
      coachNotes: 'سرعة استجابة عالية في التدريبات الثنائية ويحتاج لتركيز إضافي في الدفاع.',
      medicalNotes: 'حساسية خفيفة من الغبار.',
      parentIds: ['par_2'],
      parentNames: ['أ. طارق فؤاد'],
      isActive: true,
    },
    {
      id: 'plr_104',
      playerCode: 'XO-26-104',
      fullName: 'عمر خالد حسن',
      birthDate: '2012-11-04',
      photoUrl: '/src/assets/images/sport_gymnastics_tkd_1795470265893.jpg',
      branchId: 'branch_khalil',
      sportId: 'sport_taekwondo',
      groupId: 'grp_tkd_khalil',
      beltOrLevel: 'حزام أزرق',
      performanceScore: 86,
      coachNotes: 'جاهز لاختبار الحزام الأحمر الشهر القادم.',
      medicalNotes: 'لا توجد ملاحظات طبية.',
      parentIds: [],
      parentNames: ['غير مرتبط بعد'],
      isActive: true,
    },
    {
      id: 'plr_105',
      playerCode: 'XO-26-105',
      fullName: 'ليان محمود سامي',
      birthDate: '2011-07-18',
      photoUrl: '/src/assets/images/sport_combat_mma_1795470264712.jpg',
      branchId: 'branch_gamal',
      sportId: 'sport_mma',
      groupId: 'grp_mma_gamal',
      beltOrLevel: 'المستوى المتقدم',
      performanceScore: 93,
      coachNotes: 'لياقة بدنية استثنائية وانضباط تكتيكي ممتاز.',
      medicalNotes: 'لا توجد ملاحظات طبية.',
      parentIds: [],
      parentNames: ['غير مرتبط بعد'],
      isActive: true,
    },
  ];

  const attendance: AttendanceRecord[] = [
    {
      id: 'att_1',
      playerId: 'plr_101',
      groupId: 'grp_parkour_gamal',
      branchId: 'branch_gamal',
      sessionDate: '2026-11-22',
      status: 'present',
      note: 'أداء مميز في تمرين التوازن',
      recordedBy: 'user_coach_1',
      recordedByName: 'كابتن كريم السعدني',
    },
    {
      id: 'att_2',
      playerId: 'plr_101',
      groupId: 'grp_parkour_gamal',
      branchId: 'branch_gamal',
      sessionDate: '2026-11-19',
      status: 'present',
      note: '',
      recordedBy: 'user_coach_1',
      recordedByName: 'كابتن كريم السعدني',
    },
    {
      id: 'att_3',
      playerId: 'plr_102',
      groupId: 'grp_gymnastics_khalil',
      branchId: 'branch_khalil',
      sessionDate: '2026-11-22',
      status: 'present',
      note: 'تقدم ممتاز في تمرين العقلة',
      recordedBy: 'user_coach_2',
      recordedByName: 'كابتن سارة المهدي',
    },
    {
      id: 'att_4',
      playerId: 'plr_103',
      groupId: 'grp_kickboxing_gamal',
      branchId: 'branch_gamal',
      sessionDate: '2026-11-21',
      status: 'excused',
      note: 'عذر مدرسي مسبق',
      recordedBy: 'user_owner_1',
      recordedByName: 'كابتن عمر المنصور',
    },
    {
      id: 'att_5',
      playerId: 'plr_104',
      groupId: 'grp_tkd_khalil',
      branchId: 'branch_khalil',
      sessionDate: '2026-11-21',
      status: 'present',
      note: '',
      recordedBy: 'user_coach_2',
      recordedByName: 'كابتن سارة المهدي',
    },
  ];

  const subscriptions: SubscriptionRecord[] = [
    {
      id: 'sub_101',
      playerId: 'plr_101',
      branchId: 'branch_gamal',
      sportId: 'sport_parkour',
      planNameAr: 'اشتراك باركور شهري (12 حصة)',
      monthlyAmountEgp: 850,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'active',
    },
    {
      id: 'sub_102',
      playerId: 'plr_102',
      branchId: 'branch_khalil',
      sportId: 'sport_gymnastics',
      planNameAr: 'اشتراك جمباز شهري (12 حصة)',
      monthlyAmountEgp: 900,
      startDate: '2026-11-01',
      endDate: '2026-11-27',
      status: 'expiring_soon',
    },
    {
      id: 'sub_103',
      playerId: 'plr_103',
      branchId: 'branch_gamal',
      sportId: 'sport_kickboxing',
      planNameAr: 'اشتراك كيك بوكسينج شهري',
      monthlyAmountEgp: 800,
      startDate: '2026-10-15',
      endDate: '2026-11-15',
      status: 'expired',
    },
    {
      id: 'sub_104',
      playerId: 'plr_104',
      branchId: 'branch_khalil',
      sportId: 'sport_taekwondo',
      planNameAr: 'اشتراك تايكوندو شهري',
      monthlyAmountEgp: 750,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'active',
    },
    {
      id: 'sub_105',
      playerId: 'plr_105',
      branchId: 'branch_gamal',
      sportId: 'sport_mma',
      planNameAr: 'اشتراك MMA متقدم شهري',
      monthlyAmountEgp: 950,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'active',
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay_1',
      subscriptionId: 'sub_101',
      playerId: 'plr_101',
      branchId: 'branch_gamal',
      amountEgp: 850,
      outstandingBalanceEgp: 0,
      billingMonth: '2026-11',
      paymentMethod: 'نقدي بالفرع',
      status: 'paid',
      paidAt: '2026-11-02T14:20:00Z',
      notes: 'تم التحصيل في فرع جمال عبد الناصر',
    },
    {
      id: 'pay_2',
      subscriptionId: 'sub_102',
      playerId: 'plr_102',
      branchId: 'branch_khalil',
      amountEgp: 900,
      outstandingBalanceEgp: 0,
      billingMonth: '2026-11',
      paymentMethod: 'تحويل بنكي يدوي',
      status: 'paid',
      paidAt: '2026-11-03T16:10:00Z',
      notes: 'إيصال مراجع من الإدارة',
    },
    {
      id: 'pay_3',
      subscriptionId: 'sub_103',
      playerId: 'plr_103',
      branchId: 'branch_gamal',
      amountEgp: 800,
      outstandingBalanceEgp: 800,
      billingMonth: '2026-11',
      paymentMethod: 'نقدي بالفرع',
      status: 'overdue',
      notes: 'متبقي رسوم تجديد نوفمبر',
    },
    {
      id: 'pay_4',
      subscriptionId: 'sub_104',
      playerId: 'plr_104',
      branchId: 'branch_khalil',
      amountEgp: 750,
      outstandingBalanceEgp: 0,
      billingMonth: '2026-11',
      paymentMethod: 'نقدي بالفرع',
      status: 'paid',
      paidAt: '2026-11-04T18:00:00Z',
      notes: '',
    },
    {
      id: 'pay_5',
      subscriptionId: 'sub_105',
      playerId: 'plr_105',
      branchId: 'branch_gamal',
      amountEgp: 950,
      outstandingBalanceEgp: 450,
      billingMonth: '2026-11',
      paymentMethod: 'نقدي بالفرع',
      status: 'pending',
      notes: 'تم سداد 500 ج.م ومتبقي 450 ج.م',
    },
  ];

  const announcements: Announcement[] = [
    {
      id: 'ann_1',
      titleAr: 'انطلاق اختبارات الأحزمة الشتوية — فرع خليل حمادة',
      bodyAr: 'تبدأ اختبارات الترقية للتايكوندو والجمباز يوم الجمعة الموافق 27 نوفمبر الساعة 4 عصراً. يرجى الحضور قبل الموعد بـ 20 دقيقة بالزي الرسمي.',
      branchId: 'branch_khalil',
      priority: 'important',
      authorName: 'كابتن عمر المنصور',
      isPinned: true,
      createdAt: '2026-11-22T10:00:00Z',
    },
    {
      id: 'ann_2',
      titleAr: 'تحديث مواعيد حصص الباركور المسائية — جمال عبد الناصر',
      bodyAr: 'تم إضافة مسار تدريبي جديد داخل صالة ميامي — جمال عبد الناصر، وتستمر المواعيد دون تغيير مع زيادة وقت التبريد والإطالة.',
      branchId: 'branch_gamal',
      priority: 'normal',
      authorName: 'أ. سلمى مصطفى',
      isPinned: false,
      createdAt: '2026-11-21T15:30:00Z',
    },
  ];

  const posts: CommunityPost[] = [
    {
      id: 'post_1',
      authorId: 'user_owner_1',
      authorName: 'كابتن عمر المنصور',
      authorRole: 'OWNER',
      branchId: null,
      titleAr: 'أبطال الأسبوع في XO Sport Academy',
      bodyAr: 'فخورون بالتزام أبطالنا في فرعي جمال عبد الناصر وخليل حمادة خلال معسكر اللياقة المكثف. تذكروا دائماً: الانضباط في التمرين هو الطريق إلى المنصة!',
      category: 'إنجازات',
      isApproved: true,
      isPinned: true,
      likesCount: 14,
      likedByMe: false,
      comments: [
        {
          id: 'cmt_1',
          postId: 'post_1',
          authorId: 'user_parent_1',
          authorName: 'أ. منى عبد الرحمن',
          authorRole: 'PARENT',
          bodyAr: 'شكراً لكل المدربين على المجهود الرائع مع الأولاد.',
          createdAt: '2026-11-22T12:10:00Z',
        },
      ],
      createdAt: '2026-11-22T11:00:00Z',
    },
    {
      id: 'post_2',
      authorId: 'user_coach_1',
      authorName: 'كابتن كريم السعدني',
      authorRole: 'COACH',
      branchId: 'branch_gamal',
      titleAr: 'نصيحة تدريبية: حماية المفاصل في هبوط الباركور',
      bodyAr: 'نركز هذا الأسبوع مع مجموعة الباركور التأسيسية على تقنية الهبوط الصامت (Silent Landing) لامتصاص الصدمات وتقوية الركبة والكاحل.',
      category: 'نصائح فنية',
      isApproved: true,
      isPinned: false,
      likesCount: 9,
      likedByMe: false,
      comments: [],
      createdAt: '2026-11-21T18:45:00Z',
    },
  ];

  const media: MediaItem[] = [
    {
      id: 'med_1',
      titleAr: 'افتتاح التجهيزات الجديدة لصالة XO الرئيسية',
      albumAr: 'جولة داخل الفروع',
      kind: 'image',
      visibility: 'academy',
      branchId: null,
      groupId: null,
      playerId: null,
      fileUrl: '/src/assets/images/hero_academy_training_1795470266040.jpg',
      isPrivateAsset: false,
      uploadedByName: 'كابتن عمر المنصور',
      createdAt: '2026-11-20T09:00:00Z',
    },
    {
      id: 'med_2',
      titleAr: 'لقطات تدريب الباركور — مجموعة جمال عبد الناصر',
      albumAr: 'تدريبات الباركور',
      kind: 'image',
      visibility: 'group',
      branchId: 'branch_gamal',
      groupId: 'grp_parkour_gamal',
      playerId: null,
      fileUrl: '/src/assets/images/sport_parkour_1795470265155.jpg',
      isPrivateAsset: false,
      uploadedByName: 'كابتن كريم السعدني',
      createdAt: '2026-11-21T17:00:00Z',
    },
    {
      id: 'med_3',
      titleAr: 'تقييم فيديو خاص — قفزة توازن يوسف (XO-26-101)',
      albumAr: 'تقييمات خاصة باللاعبين',
      kind: 'image',
      visibility: 'private_player',
      branchId: 'branch_gamal',
      groupId: 'grp_parkour_gamal',
      playerId: 'plr_101',
      fileUrl: '/src/assets/images/sport_parkour_1795470265155.jpg',
      isPrivateAsset: false,
      uploadedByName: 'كابتن كريم السعدني',
      createdAt: '2026-11-22T18:20:00Z',
    },
    {
      id: 'med_4',
      titleAr: 'حصة التايكوندو والجمباز — فرع خليل حمادة',
      albumAr: 'تدريبات خليل حمادة',
      kind: 'image',
      visibility: 'branch',
      branchId: 'branch_khalil',
      groupId: 'grp_gymnastics_khalil',
      playerId: null,
      fileUrl: '/src/assets/images/sport_gymnastics_tkd_1795470265893.jpg',
      isPrivateAsset: false,
      uploadedByName: 'كابتن سارة المهدي',
      createdAt: '2026-11-22T16:40:00Z',
    },
  ];

  const events: AcademyEvent[] = [
    {
      id: 'evt_1',
      titleAr: 'بطولة XO الإسكندرية التنشيطية للناشئين',
      descriptionAr: 'منافسات رسمية في التايكوندو والكيك بوكسينج والباركور بمشاركة لاعبي فرعي جمال عبد الناصر وخليل حمادة.',
      eventType: 'بطولة',
      branchId: 'branch_gamal',
      sportId: 'sport_taekwondo',
      eventDate: '2026-12-05T15:00:00Z',
      locationAr: 'الصالة المغطاة — ميامي، الإسكندرية',
      maxParticipants: 80,
      resultsSummaryAr: 'التسجيل مفتوح حالياً للأعضاء النشطين.',
      status: 'upcoming',
      imageUrl: '/src/assets/images/academy_trophy_event_1795470266547.jpg',
      registrations: [
        {
          id: 'evr_1',
          eventId: 'evt_1',
          playerId: 'plr_101',
          playerName: 'يوسف أحمد علي',
          playerCode: 'XO-26-101',
          status: 'confirmed',
          achievementAr: '',
        },
        {
          id: 'evr_2',
          eventId: 'evt_1',
          playerId: 'plr_104',
          playerName: 'عمر خالد حسن',
          playerCode: 'XO-26-104',
          status: 'registered',
          achievementAr: '',
        },
      ],
    },
    {
      id: 'evt_2',
      titleAr: 'تحدي XO للسرعة والمرونة',
      descriptionAr: 'تحدي داخلي لتقييم مستوى التطور البدني في الجمباز والباركور وتوزيع شهادات التميز.',
      eventType: 'تحدي داخلي',
      branchId: 'branch_khalil',
      sportId: 'sport_gymnastics',
      eventDate: '2026-11-14T16:00:00Z',
      locationAr: 'فرع ميامي — خليل حمادة',
      maxParticipants: 40,
      resultsSummaryAr: 'حصلت اللاعبة مريم أحمد علي على المركز الأول في فئة البراعم.',
      status: 'completed',
      imageUrl: '/src/assets/images/sport_gymnastics_tkd_1795470265893.jpg',
      registrations: [
        {
          id: 'evr_3',
          eventId: 'evt_2',
          playerId: 'plr_102',
          playerName: 'مريم أحمد علي',
          playerCode: 'XO-26-102',
          status: 'confirmed',
          achievementAr: 'المركز الأول — براعم الجمباز',
        },
      ],
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'not_1',
      userId: 'user_parent_1',
      titleAr: 'تذكير بقرب انتهاء اشتراك مريم',
      bodyAr: 'ينتهي اشتراك الجمباز الخاص باللاعبة مريم أحمد علي يوم 2026-11-27.',
      category: 'subscription',
      isRead: false,
      createdAt: '2026-11-23T09:00:00Z',
    },
    {
      id: 'not_2',
      userId: 'user_parent_2',
      titleAr: 'تنبيه رسوم مستحقة',
      bodyAr: 'يوجد رصيد متبقي بقيمة 800 ج.م على اشتراك اللاعب حمزة طارق فؤاد.',
      category: 'subscription',
      isRead: false,
      createdAt: '2026-11-23T08:30:00Z',
    },
    {
      id: 'not_3',
      userId: 'user_owner_1',
      titleAr: 'تقرير الحضور اليومي جاهز',
      bodyAr: 'تم تسجيل حضور مجموعات فرع جمال عبد الناصر وخليل حمادة بنجاح.',
      category: 'attendance',
      isRead: false,
      createdAt: '2026-11-22T20:00:00Z',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      actorUserId: 'user_owner_1',
      actorName: 'كابتن عمر المنصور',
      actorRole: 'OWNER',
      action: 'GRANT_DELEGATE_PERMISSION',
      targetTable: 'delegate_permissions',
      targetId: 'del_1',
      branchId: 'branch_gamal',
      details: { permissions: ['manage_players', 'manage_attendance', 'manage_payments', 'view_reports'] },
      createdAt: '2026-11-20T10:15:00Z',
    },
    {
      id: 'aud_2',
      actorUserId: 'user_coach_1',
      actorName: 'كابتن كريم السعدني',
      actorRole: 'COACH',
      action: 'RECORD_ATTENDANCE',
      targetTable: 'attendance',
      targetId: 'grp_parkour_gamal',
      branchId: 'branch_gamal',
      details: { sessionDate: '2026-11-22', count: 1 },
      createdAt: '2026-11-22T18:30:00Z',
    },
  ];

  return {
    users,
    branches,
    sports,
    coaches,
    groups,
    delegates,
    parents,
    players,
    attendance,
    subscriptions,
    payments,
    announcements,
    posts,
    postLikes: { post_1: ['user_parent_1'] },
    media,
    events,
    notifications,
    auditLogs,
    resetTokens: [],
    uploadedFiles: new Map(),
  };
}

let currentStore: StoreState = createInitialState();

export function getStore(): StoreState {
  return currentStore;
}

export function resetStoreForTests(): StoreState {
  currentStore = createInitialState();
  return currentStore;
}
