import { z } from 'zod';

export const adminLoginSchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });
export const adminActionSchema = z.object({
  action: z.enum(['verify_user','unverify_user','ban_user','unban_user','verify_channel','unverify_channel','delete_channel','delete_group']),
  target: z.string().uuid(), reason: z.string().max(1000).optional(), expires: z.string().datetime().optional(),
}).superRefine((v,ctx) => {
  if(v.action==='ban_user' && (v.reason?.trim().length ?? 0)<3) ctx.addIssue({code:'custom',message:'Enter a ban reason',path:['reason']});
  if(v.expires && Date.parse(v.expires)<=Date.now()) ctx.addIssue({code:'custom',message:'Expiration must be in the future',path:['expires']});
});
export const adminPasswordSchema = z.object({ currentPassword:z.string().min(1).max(200), password:z.string().min(12).max(200) });
export function activeBan(ban: {revoked_at: string|null; expires_at:string|null}|null|undefined, now=Date.now()) {
  return Boolean(ban && !ban.revoked_at && (!ban.expires_at || Date.parse(ban.expires_at)>now));
}