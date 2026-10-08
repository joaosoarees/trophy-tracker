import { type CheckResult } from '@shared/types/Check';
import { type DashboardMode, type IGameSummary } from '@shared/types/Game';

import { Service } from './Service';

export class DashboardService extends Service {
  static getDashboard(
    mode: DashboardMode = 'cached',
  ): Promise<CheckResult<IGameSummary[]>> {
    return this.api.getDashboard(mode);
  }

  /** Returns the function that stops listening. */
  static onProgress(
    listener: (done: number, total: number) => void,
  ): () => void {
    return this.api.onDashboardProgress(listener);
  }
}
