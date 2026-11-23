export type AppRole = 'OWNER' | 'DELEGATE' | 'COACH' | 'PARENT' | 'PLAYER';

export type DelegatePermissionKey =
  | 'manage_players'
  | 'manage_attendance'
  | 'manage_payments'
  | 'manage_media'
  | 'manage_events'
  | 'manage_community'
  | 'view_reports';

export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired' | 'frozen';
export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'refunded';
export type MediaVisibility = 'academy' | 'group' | 'branch' | 'private_player';
export type MediaKind = 'image' | 'video';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: AppRole;
  isActive: boolean;
  assignedBranchIds: string[];
  delegatePermissions: Array<{ branchId: string; permission: DelegatePermissionKey }>;
  assignedGroupIds: string[];
  linkedPlayerIds: string[]; // For PARENT (their children) or PLAYER (themselves)
}

export interface Branch {
  id: string;
  nameAr: string;
  addressAr: string;
  phone: string;
  isActive: boolean;
}

export interface Sport {
  id: string;
  nameAr: string;
  slug: string;
  descriptionAr: string;
  monthlyFeeEgp: number;
  imageUrl: string;
  isActive: boolean;
}

export interface Coach {
  id: string;
  userId?: string;
  fullName: string;
  specialtySportId: string;
  primaryBranchId: string;
  bioAr: string;
  assignedGroupIds: string[];
  isActive: boolean;
}

export interface TrainingGroup {
  id: string;
  nameAr: string;
  branchId: string;
  sportId: string;
  ageRange: string;
  scheduleDays: string;
  scheduleTime: string;
  maxCapacity: number;
  coachIds: string[];
  isActive: boolean;
}

export interface Player {
  id: string;
  userId?: string;
  playerCode: string;
  fullName: string;
  birthDate: string;
  photoUrl: string;
  branchId: string;
  sportId: string;
  groupId: string;
  beltOrLevel: string;
  performanceScore: number;
  coachNotes: string;
  medicalNotes: string;
  parentIds: string[];
  parentNames: string[];
  isActive: boolean;
}

export interface ParentRecord {
  id: string;
  userId?: string;
  fullName: string;
  phone: string;
  email: string;
  emergencyContact: string;
  playerIds: string[];
}

export interface DelegateRecord {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  assignedBranchIds: string[];
  permissions: Array<{ branchId: string; permission: DelegatePermissionKey }>;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  playerId: string;
  groupId: string;
  branchId: string;
  sessionDate: string;
  status: AttendanceStatus;
  note: string;
  recordedBy: string;
  recordedByName: string;
}

export interface SubscriptionRecord {
  id: string;
  playerId: string;
  branchId: string;
  sportId: string;
  planNameAr: string;
  monthlyAmountEgp: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
}

export interface PaymentRecord {
  id: string;
  subscriptionId?: string;
  playerId: string;
  branchId: string;
  amountEgp: number;
  outstandingBalanceEgp: number;
  billingMonth: string; // YYYY-MM
  paymentMethod: string;
  status: PaymentStatus;
  paidAt?: string;
  notes: string;
}

export interface Announcement {
  id: string;
  titleAr: string;
  bodyAr: string;
  branchId: string | null;
  priority: 'normal' | 'important' | 'urgent';
  authorName: string;
  isPinned: boolean;
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: AppRole;
  bodyAr: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: AppRole;
  branchId: string | null;
  titleAr: string;
  bodyAr: string;
  category: string;
  isApproved: boolean;
  isPinned: boolean;
  likesCount: number;
  likedByMe: boolean;
  comments: CommunityComment[];
  createdAt: string;
}

export interface MediaItem {
  id: string;
  titleAr: string;
  albumAr: string;
  kind: MediaKind;
  visibility: MediaVisibility;
  branchId: string | null;
  groupId: string | null;
  playerId: string | null;
  fileUrl: string;
  isPrivateAsset: boolean;
  uploadedByName: string;
  createdAt: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  playerId: string;
  playerName: string;
  playerCode: string;
  status: 'registered' | 'confirmed' | 'withdrawn';
  achievementAr: string;
}

export interface AcademyEvent {
  id: string;
  titleAr: string;
  descriptionAr: string;
  eventType: string;
  branchId: string | null;
  sportId: string | null;
  eventDate: string;
  locationAr: string;
  maxParticipants: number;
  resultsSummaryAr: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  imageUrl: string;
  registrations: EventRegistration[];
}

export interface AppNotification {
  id: string;
  userId: string;
  titleAr: string;
  bodyAr: string;
  category: 'announcement' | 'event' | 'subscription' | 'attendance' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: AppRole | null;
  action: string;
  targetTable: string;
  targetId: string | null;
  branchId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SystemConfigStatus {
  supabaseUrlConfigured: boolean;
  supabaseAnonKeyConfigured: boolean;
  supabaseServiceKeyConfigured: boolean;
  isSupabaseConnected: boolean;
  onlinePaymentsConfigured: boolean;
  mode: 'supabase' | 'local_preview';
  missingKeys: string[];
}
