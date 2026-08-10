export type GuestPassStatus = "valid" | "scheduled" | "expired" | "used" | "revoked";

export type GuestPass = {
  id: string;
  site: string;
  guestName: string;
  discipline: string;
  hostName: string;
  notes: string;
  active: boolean;
  uses: number;
  maxUses: number;
  validFrom: string | null;
  validUntil: string | null;
  lastUsedAt: string | null;
  history: Array<{ at: string; remaining: number }>;
  createdAt: string | null;
};

export function guestPassStatus(pass: GuestPass, now = Date.now()): GuestPassStatus {
  if (pass.uses >= pass.maxUses) return "used";
  if (!pass.active) return "revoked";
  const start = pass.validFrom ? new Date(pass.validFrom).getTime() : 0;
  const end = pass.validUntil ? new Date(pass.validUntil).getTime() : 0;
  if (start > now) return "scheduled";
  if (!end || end < now) return "expired";
  return "valid";
}

export function remainingUses(pass: GuestPass) {
  return Math.max(0, pass.maxUses - pass.uses);
}
