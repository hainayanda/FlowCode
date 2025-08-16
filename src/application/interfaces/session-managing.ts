import { Result } from '../../shared/result';
import { VectorProviderConfig } from '../stores/config-repository';

export interface SessionInfo {
  name: string;
  createdDate: string;
  lastActiveDate: string;
  vectorProvider: VectorProviderConfig;
}

export interface SessionManaging {
  initializeSession(): Promise<Result<SessionInfo, string>>;
  getCurrentSession(): Promise<Result<SessionInfo | null, string>>;
  getAllSession(): Promise<Result<SessionInfo[], string>>;
  switchSessions(sessionName: string): Promise<Result<void, string>>;
}