// Deployment System Type Definitions
// TypeScript interfaces and types for type-safe deployment operations

/**
 * Deployment Types
 */
export type DeploymentType = 'feature' | 'bugfix' | 'hotfix' | 'rollback';

/**
 * Deployment Status
 */
export type DeploymentStatus =
  | 'pending'
  | 'approved'
  | 'deploying'
  | 'completed'
  | 'failed'
  | 'rolled_back';

/**
 * Main Deployment Entity
 */
export interface Deployment {
  id: string;
  environment_id: string;
  deployment_type: DeploymentType;
  description: string;
  requested_by: string;
  status: DeploymentStatus;
  scheduled_at?: Date;
  rollback_from_id?: string;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

/**
 * Request to create a deployment
 */
export interface CreateDeploymentRequest {
  environmentId: string;
  deploymentType: DeploymentType;
  description: string;
  scheduledAt?: Date;
}

/**
 * Request to update deployment status
 */
export interface UpdateDeploymentRequest {
  status: DeploymentStatus;
  errorMessage?: string;
}

/**
 * Activity Log Entry
 */
export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id: string;
  changes: Record<string, any>;
  gps_coordinates?: GPSCoordinates;
  ip_address?: string;
  user_agent?: string;
  session_id: string;
  timestamp: Date;
}

/**
 * GPS Coordinates
 */
export interface GPSCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Request to log activity
 */
export interface CreateActivityLogRequest {
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  gpsCoordinates?: GPSCoordinates;
}

/**
 * Immutable Document for audit trail
 */
export interface ImmutableDocument {
  id: string;
  document_type: string;
  content: Record<string, any>;
  hash: string;
  previous_hash?: string;
  created_by: string;
  created_at: Date;
  immutable: boolean;
}

/**
 * Request to create immutable document
 */
export interface CreateImmutableDocumentRequest {
  documentType: string;
  content: Record<string, any>;
  previousDocumentId?: string;
}

/**
 * Deletion Attempt Record
 */
export interface DeletionAttempt {
  id: string;
  target_type: string;
  target_id: string;
  attempted_by: string;
  reason?: string;
  timestamp: Date;
  blocked: boolean;
  block_reason?: string;
}

/**
 * Request to log deletion attempt
 */
export interface CreateDeletionAttemptRequest {
  targetType: string;
  targetId: string;
  reason?: string;
}

/**
 * Request to rollback deployment
 */
export interface RollbackDeploymentRequest {
  reason: string;
}

/**
 * Deployment Metrics
 */
export interface DeploymentMetrics {
  successRate: number;
  totalDeployments: number;
  completed: number;
  failed: number;
  rolledBack: number;
  averageDeploymentTimeSeconds: number;
  byDeploymentType: DeploymentTypeMetric[];
  byEnvironment: EnvironmentMetric[];
}

/**
 * Deployment metrics by type
 */
export interface DeploymentTypeMetric {
  deployment_type: DeploymentType;
  count: number;
  successful: number;
}

/**
 * Deployment metrics by environment
 */
export interface EnvironmentMetric {
  environment_id: string;
  count: number;
  successful: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  details?: string;
  errors?: string[];
  statusCode: number;
}

/**
 * Deployment List Filters
 */
export interface DeploymentFilters {
  status?: DeploymentStatus;
  environmentId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Activity Log List Filters
 */
export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Deletion Attempt Filters
 */
export interface DeletionAttemptFilters {
  targetType?: string;
  blockedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Service response for rollback
 */
export interface RollbackResponse {
  rollback: Deployment;
  previousDeployment: Deployment;
}

/**
 * Immutable document with verification
 */
export interface VerifiedImmutableDocument extends ImmutableDocument {
  hashVerified: boolean;
}

/**
 * Deployment with activity context
 */
export interface DeploymentWithActivity extends Deployment {
  activityLogs: ActivityLog[];
}

/**
 * User context in requests
 */
export interface UserContext {
  userId: string;
  userType: 'admin' | 'attorney' | 'client';
  email: string;
}

/**
 * Request context including user and location
 */
export interface RequestContext {
  user: UserContext;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  gpsCoordinates?: GPSCoordinates;
}

/**
 * Deployment validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Deployment state transition
 */
export interface StateTransition {
  from: DeploymentStatus;
  to: DeploymentStatus;
  timestamp: Date;
  triggeredBy: string;
}

/**
 * Document chain verification result
 */
export interface ChainVerificationResult {
  valid: boolean;
  documents: ImmutableDocument[];
  invalidAt?: number; // Index of first invalid document
  reason?: string;
}

/**
 * Audit summary for period
 */
export interface AuditSummary {
  period: {
    start: Date;
    end: Date;
  };
  totalActions: number;
  actionsByType: Record<string, number>;
  users: string[];
  resources: string[];
  suspiciousActivities: ActivityLog[];
}

/**
 * Deployment statistics
 */
export interface DeploymentStatistics {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  averageDurationMs: number;
  medianDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  successRatePercentage: number;
  rollbackRate: number;
}

/**
 * Environment health
 */
export interface EnvironmentHealth {
  environmentId: string;
  lastDeployment?: Deployment;
  lastSuccessfulDeployment?: Deployment;
  daysSinceLastDeploy: number;
  deploymentsTodayCount: number;
  failureRate: number;
  isHealthy: boolean;
  alerts: string[];
}

/**
 * Batch deployment response
 */
export interface BatchDeploymentResponse {
  successful: Deployment[];
  failed: Array<{
    deployment: Partial<Deployment>;
    error: string;
  }>;
  totalCount: number;
  successCount: number;
}

/**
 * GPS anomaly detection result
 */
export interface GPSAnomalyResult {
  isAnomaly: boolean;
  lastKnownLocation?: GPSCoordinates;
  distance: number; // km
  velocity: number; // km/h
  isPhysicallyPossible: boolean;
  confidence: number; // 0-1
}

/**
 * Security audit event
 */
export interface SecurityAuditEvent {
  eventId: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUser?: string;
  affectedResource?: string;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Deployment webhook payload
 */
export interface DeploymentWebhookPayload {
  eventType: 'deployment.created' | 'deployment.updated' | 'deployment.completed' | 'deployment.failed' | 'deployment.rolledback';
  deployment: Deployment;
  timestamp: Date;
  requestId: string;
}
