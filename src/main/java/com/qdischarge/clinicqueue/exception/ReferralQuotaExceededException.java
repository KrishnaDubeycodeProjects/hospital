package com.qdischarge.clinicqueue.exception;

public class ReferralQuotaExceededException extends RuntimeException {

    private final String priorityTier;
    private final String hospitalName;
    private final int activeCount;
    private final int maxQuota;

    public ReferralQuotaExceededException(String priorityTier, String hospitalName, int activeCount, int maxQuota) {
        super(String.format("Referral quota exceeded for %s at %s. Active: %d/%d. Consider overriding or selecting an alternate facility.",
                priorityTier, hospitalName, activeCount, maxQuota));
        this.priorityTier = priorityTier;
        this.hospitalName = hospitalName;
        this.activeCount = activeCount;
        this.maxQuota = maxQuota;
    }

    public String getPriorityTier() {
        return priorityTier;
    }

    public String getHospitalName() {
        return hospitalName;
    }

    public int getActiveCount() {
        return activeCount;
    }

    public int getMaxQuota() {
        return maxQuota;
    }
}
