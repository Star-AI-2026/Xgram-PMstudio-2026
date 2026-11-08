import { describe,it,expect } from 'vitest';
import { activeBan,adminActionSchema,adminPasswordSchema } from './admin.schemas';
describe('Xgram moderation rules',()=>{
  it('permanent bans stay active after refresh',()=>expect(activeBan({revoked_at:null,expires_at:null},100000)).toBe(true));
  it('temporary bans expire at the saved date',()=>expect(activeBan({revoked_at:null,expires_at:'2026-11-01T00:00:00Z'},Date.parse('2026-11-01T00:00:00Z'))).toBe(false));
  it('unbanned accounts no longer have restrictions',()=>expect(activeBan({revoked_at:'2026-11-01T00:00:00Z',expires_at:null})).toBe(false));
  it('banning requires a nonempty reason',()=>expect(adminActionSchema.safeParse({action:'ban_user',target:'00000000-0000-4000-8000-000000000001',reason:''}).success).toBe(false));
  it('ban expiration must be future dated',()=>expect(adminActionSchema.safeParse({action:'ban_user',target:'00000000-0000-4000-8000-000000000001',reason:'Test ban',expires:'2020-01-01T00:00:00Z'}).success).toBe(false));
  it('administrative targets must be validated IDs',()=>expect(adminActionSchema.safeParse({action:'delete_group',target:'not-an-id'}).success).toBe(false));
  it('new administrator passwords require 12 characters',()=>expect(adminPasswordSchema.safeParse({currentPassword:'current',password:'12345678901'}).success).toBe(false));
});