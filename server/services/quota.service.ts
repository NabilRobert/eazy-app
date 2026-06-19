import prisma from '~/server/utils/prisma'

const DAILY_LIMIT = 30

/**
 * Service for managing daily application quotas. The "day" is computed in the
 * user's timezone so quotas reset at their local midnight (not the server's).
 */
export class QuotaService {
  /** Resolve the user's IANA timezone (defaults to UTC). */
  private static async getTimezone(userId: string): Promise<string> {
    const p = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { timezone: true }
    })
    return p?.timezone || 'UTC'
  }

  /**
   * The user's current local calendar day as a UTC-midnight Date — a stable
   * per-timezone key for the daily_quota row.
   */
  static localDay(tz: string, now: Date = new Date()): Date {
    try {
      const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now)
      return new Date(`${ymd}T00:00:00.000Z`)
    } catch {
      // Invalid timezone — fall back to UTC day.
      const ymd = now.toISOString().slice(0, 10)
      return new Date(`${ymd}T00:00:00.000Z`)
    }
  }

  /** Get or create the quota row for the user's current local day. */
  static async getOrCreateQuota(userId: string) {
    const tz = await this.getTimezone(userId)
    const date = this.localDay(tz)

    let quota = await prisma.dailyQuota.findUnique({
      where: { userId_date: { userId, date } }
    })
    if (!quota) {
      quota = await prisma.dailyQuota.create({
        data: { userId, date, autoApplied: 0, confirmedApplied: 0, totalApplied: 0, stopFlag: false }
      })
    }
    return quota
  }

  static async incrementAutoApplied(userId: string): Promise<void> {
    const quota = await this.getOrCreateQuota(userId)
    await prisma.dailyQuota.update({
      where: { id: quota.id },
      data: { autoApplied: { increment: 1 }, totalApplied: { increment: 1 } }
    })
  }

  static async incrementConfirmedApplied(userId: string): Promise<void> {
    const quota = await this.getOrCreateQuota(userId)
    await prisma.dailyQuota.update({
      where: { id: quota.id },
      data: { confirmedApplied: { increment: 1 }, totalApplied: { increment: 1 } }
    })
  }

  static async isQuotaExceeded(userId: string): Promise<boolean> {
    const quota = await this.getOrCreateQuota(userId)
    return quota.totalApplied >= DAILY_LIMIT
  }

  /**
   * Remaining slots. Auto-apply is capped at 20 while there are confirmed
   * review items waiting to be applied (10 reserved for them); when none are
   * pending, the auto cap expands to the full 30.
   */
  static async getAvailableSlots(userId: string): Promise<{ autoSlots: number; totalSlots: number }> {
    const quota = await this.getOrCreateQuota(userId)
    const confirmedPending = await prisma.reviewQueue.count({
      where: { userId, status: 'confirmed' }
    })
    const autoCap = confirmedPending > 0 ? 20 : DAILY_LIMIT
    const autoSlots = Math.max(0, Math.min(autoCap - quota.autoApplied, DAILY_LIMIT - quota.totalApplied))
    const totalSlots = Math.max(0, DAILY_LIMIT - quota.totalApplied)
    return { autoSlots, totalSlots }
  }

  static async setStopFlag(userId: string, flag: boolean): Promise<void> {
    const quota = await this.getOrCreateQuota(userId)
    await prisma.dailyQuota.update({ where: { id: quota.id }, data: { stopFlag: flag } })
  }
}

export function createQuotaService() {
  return QuotaService
}
