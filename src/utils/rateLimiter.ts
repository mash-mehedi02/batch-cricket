/**
 * Progressive Rate Limiter
 * - 3 wrong attempts → locked for 5 minutes
 * - After unlock, 3 more wrong → locked for 10 minutes
 * - Each cycle adds 5 minutes to the lockout duration
 * - Persisted in localStorage across page refreshes
 */

export interface LockoutStatus {
    isLocked: boolean;
    remainingMs: number;
    remainingAttempts: number;
    attemptsUsed: number;
    maxAttempts: number;
    lockoutMinutes: number;
}

interface StoredData {
    count: number;        // attempts in current cycle
    lockedAt: number;     // timestamp when lockout started (0 = not locked)
    lockoutMs: number;    // current lockout duration in ms
    cycle: number;        // how many lockout cycles have occurred
}

export class RateLimiter {
    private key: string;
    private maxAttempts: number;
    private baseLockoutMinutes: number;

    constructor(key: string, maxAttempts = 3, baseLockoutMinutes = 5) {
        this.key = `rl_${key}`;
        this.maxAttempts = maxAttempts;
        this.baseLockoutMinutes = baseLockoutMinutes;
    }

    private getData(): StoredData | null {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            localStorage.removeItem(this.key);
            return null;
        }
    }

    private setData(data: StoredData) {
        localStorage.setItem(this.key, JSON.stringify(data));
    }

    /**
     * Get the current lockout status without modifying state
     */
    getStatus(): LockoutStatus {
        const data = this.getData();
        if (!data) {
            return {
                isLocked: false,
                remainingMs: 0,
                remainingAttempts: this.maxAttempts,
                attemptsUsed: 0,
                maxAttempts: this.maxAttempts,
                lockoutMinutes: this.baseLockoutMinutes,
            };
        }

        const now = Date.now();

        // Check if currently locked
        if (data.lockedAt > 0) {
            const elapsed = now - data.lockedAt;
            if (elapsed < data.lockoutMs) {
                // Still locked
                return {
                    isLocked: true,
                    remainingMs: data.lockoutMs - elapsed,
                    remainingAttempts: 0,
                    attemptsUsed: data.count,
                    maxAttempts: this.maxAttempts,
                    lockoutMinutes: data.lockoutMs / 60000,
                };
            } else {
                // Lockout expired — reset attempts but keep cycle count
                const newData: StoredData = {
                    count: 0,
                    lockedAt: 0,
                    lockoutMs: 0,
                    cycle: data.cycle,
                };
                this.setData(newData);
                return {
                    isLocked: false,
                    remainingMs: 0,
                    remainingAttempts: this.maxAttempts,
                    attemptsUsed: 0,
                    maxAttempts: this.maxAttempts,
                    lockoutMinutes: this.baseLockoutMinutes * (data.cycle + 1),
                };
            }
        }

        // Not locked, return attempt info
        const remaining = this.maxAttempts - data.count;
        return {
            isLocked: false,
            remainingMs: 0,
            remainingAttempts: Math.max(0, remaining),
            attemptsUsed: data.count,
            maxAttempts: this.maxAttempts,
            lockoutMinutes: this.baseLockoutMinutes * (data.cycle + 1),
        };
    }

    /**
     * Check if login is allowed. Returns true if allowed.
     */
    checkLimit(): boolean {
        const status = this.getStatus();
        return !status.isLocked;
    }

    /**
     * Record a failed attempt. If max is reached, triggers lockout.
     */
    increment(): LockoutStatus {
        const data = this.getData() || { count: 0, lockedAt: 0, lockoutMs: 0, cycle: 0 };
        const now = Date.now();

        // If locked and expired, reset attempts but keep cycle
        if (data.lockedAt > 0 && (now - data.lockedAt) >= data.lockoutMs) {
            data.count = 0;
            data.lockedAt = 0;
            data.lockoutMs = 0;
        }

        data.count += 1;

        if (data.count >= this.maxAttempts) {
            // Trigger lockout: duration = baseLockoutMinutes * (cycle + 1)
            const lockoutMinutes = this.baseLockoutMinutes * (data.cycle + 1);
            data.lockedAt = now;
            data.lockoutMs = lockoutMinutes * 60 * 1000;
            data.cycle += 1;
            this.setData(data);

            return {
                isLocked: true,
                remainingMs: data.lockoutMs,
                remainingAttempts: 0,
                attemptsUsed: data.count,
                maxAttempts: this.maxAttempts,
                lockoutMinutes: lockoutMinutes,
            };
        }

        this.setData(data);

        return {
            isLocked: false,
            remainingMs: 0,
            remainingAttempts: this.maxAttempts - data.count,
            attemptsUsed: data.count,
            maxAttempts: this.maxAttempts,
            lockoutMinutes: this.baseLockoutMinutes * (data.cycle + 1),
        };
    }

    /**
     * Full reset on successful login
     */
    reset() {
        localStorage.removeItem(this.key);
    }
}

// 3 attempts, 5 minutes base lockout (progressive: 5, 10, 15, 20...)
export const loginRateLimiter = new RateLimiter('login', 3, 5);
export const requestRateLimiter = new RateLimiter('api', 20, 1);
