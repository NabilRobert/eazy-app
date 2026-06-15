import prisma from '~/server/utils/prisma'

/**
 * Service for managing daily application quotas
 */
export class QuotaService {
  /**
   * Get or create daily quota for user
   */
  static async getOrCreateQuota(userId: string, date: Date = new Date()) {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    let quota = await prisma.dailyQuota.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateOnly
        }
      }
    })

    if (!quota) {
      quota = await prisma.dailyQuota.create({
        data: {
          userId,
          date: dateOnly,
          autoApplied: 0,
          confirmedApplied: 0,
          totalApplied: 0,
          stopFlag: false
        }
      })
    }

    return quota
  }

  /**
   * Increment auto-applied counter
   */
  static async incrementAutoApplied(userId: string): Promise<void> {
    const quota = await this.getOrCreateQuota(userId)

    await prisma.dailyQuota.update({
      where: { id: quota.id },
      data: {
        autoApplied: { increment: 1 },
        totalApplied: { increment: 1 }
      }
    })
  }

  /**
   * Increment confirmed-applied counter
   */
  static async incrementConfirmedApplied(userId: string): Promise<void> {
    const quota = await this.getOrCreateQuota(userId)

    await prisma.dailyQuota.update({
      where: { id: quota.id },
      data: {
        confirmedApplied: { increment: 1 },
        totalApplied: { increment: 1 }
      }
    })
  }

  /**
   * Check if quota is exceeded
   */
  static async isQuotaExceeded(userId: string): Promise<boolean> {
    const quota = await this.getOrCreateQuota(userId)
    return quota.totalApplied >= 30
  }

  /**
   * Check available slots
   */
  static async getAvailableSlots(userId: string): Promise<{ autoSlots: number; totalSlots: number }> {
    const quota = await this.getOrCreateQuota(userId)

    const autoSlots = Math.max(0, 20 - quota.autoApplied)
    const totalSlots = Math.max(0, 30 - quota.totalApplied)

    return { autoSlots, totalSlots }
  }

  /**
   * Set stop flag
   */
  static async setStopFlag(userId: string, flag: boolean): Promise<void> {
    const quota = await this.getOrCreateQuota(userId)

    await prisma.dailyQuota.update({
      where: { id: quota.id },
      data: { stopFlag: flag }
    })
  }

  /**
   * Reset quota at midnight
   */
  static async resetQuotaIfNeeded(userId: string): Promise<boolean> {
    const quota = await this.getOrCreateQuota(userId)
    const today = new Date()
    const quotaDate = new Date(quota.date)

    if (quotaDate.toDateString() !== today.toDateString()) {
      // Create new quota for today
      await this.getOrCreateQuota(userId, today)
      return true
    }

    return false
  }
}

export function createQuotaService() {
  return QuotaService
}
