import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { adminLoginSchema,adminActionSchema,adminPasswordSchema,activeBan } from './admin.schemas';

export const adminLogin=createServerFn({method:'POST'}).inputValidator(adminLoginSchema).handler(async({data})=>{
  const {loginAdmin}=await import('./admin.server');return loginAdmin(data.username,data.password);
});
export const adminIdentity=createServerFn({method:'GET'}).handler(async()=>{
  try {const {requireAdmin}=await import('./admin.server');const {user}=await requireAdmin();return {id:user.id,username:'Xgram.Admin'};}catch{return null;}
});
export const adminLogout=createServerFn({method:'POST'}).handler(async()=>{
  const {requireAdmin}=await import('./admin.server');const {admin,session}=await requireAdmin();const token=session.data.accessToken;if(token)await admin.auth.admin.signOut(token,'local');await session.clear();return {ok:true};
});
export const adminData=createServerFn({method:'POST'}).inputValidator(z.object({section:z.enum(['dashboard','users','verified','banned','channels','groups','logs']),query:z.string().max(200).default(''),page:z.number().int().min(0).default(0)})).handler(async({data})=>{
  const {requireAdmin}=await import('./admin.server');const {admin}=await requireAdmin();
  const [profiles,chats,members,bans,logs]=await Promise.all([admin.from('profiles').select('*').order('created_at',{ascending:false}),admin.from('chats').select('*').in('type',['channel','group']).order('created_at',{ascending:false}),admin.from('chat_members').select('chat_id,user_id,role'),admin.from('account_bans').select('*'),admin.from('admin_audit_logs').select('*').order('created_at',{ascending:false}).limit(500)]);
  for(const r of [profiles,chats,members,bans,logs])if(r.error)throw new Error('Could not load administration data');
  // Auth admin pagination avoids leaking emails through any public/profile query.
  const accounts=[];for(let page=1;;page++){const r=await admin.auth.admin.listUsers({page,perPage:1000});if(r.error)throw new Error('Could not load accounts');accounts.push(...r.data.users);if(r.data.users.length<1000)break;}
  const accountMap=new Map(accounts.map(u=>[u.id,u]));const profileMap=new Map((profiles.data??[]).map(p=>[p.id,p]));const banMap=new Map((bans.data??[]).map(b=>[b.user_id,b]));
  const users=(profiles.data??[]).map(p=>({id:p.id,username:p.username,display_name:p.display_name,avatar_url:p.avatar_url,bio:p.bio,phone:p.phone,is_verified:p.is_verified,created_at:accountMap.get(p.id)?.created_at??p.created_at,email:accountMap.get(p.id)?.email??'',last_sign_in_at:accountMap.get(p.id)?.last_sign_in_at??null,ban:banMap.get(p.id)??null,banned:activeBan(banMap.get(p.id))}));
  const conversations=(chats.data??[]).map(c=>({...c,owner:profileMap.get(c.created_by)?.username??c.created_by,member_count:(members.data??[]).filter(m=>m.chat_id===c.id).length}));
  const stats={users:accounts.length,verified:users.filter(u=>u.is_verified).length,banned:users.filter(u=>u.banned).length,channels:conversations.filter(c=>c.type==='channel').length,groups:conversations.filter(c=>c.type==='group').length};
  const q=data.query.toLowerCase().trim();
  const rows=data.section==='logs'?(logs.data??[]).map(l=>({...l,label:l.target_label??l.target_id??'Administrator'})).filter(l=>`${l.action} ${l.label}`.toLowerCase().includes(q)):
    data.section==='channels'||data.section==='groups'?conversations.filter(c=>c.type===(data.section==='channels'?'channel':'group')&&`${c.title} ${c.username} ${c.owner}`.toLowerCase().includes(q)):
    users.filter(u=>(data.section!=='verified'||u.is_verified)&&(data.section!=='banned'||u.banned)&&`${u.username} ${u.display_name} ${u.email}`.toLowerCase().includes(q));
  return {stats,rows:rows.slice(data.page*25,(data.page+1)*25),total:rows.length,recentUsers:users.slice(0,6),recentLogs:(logs.data??[]).slice(0,6),cleanupPending:(await admin.from('admin_storage_cleanup').select('id',{count:'exact',head:true})).count??0};
});
export const adminAction=createServerFn({method:'POST'}).inputValidator(adminActionSchema).handler(async({data})=>{
  const {requireAdmin,cleanupStorage}=await import('./admin.server');const {admin,user}=await requireAdmin();
  const r=await admin.rpc('admin_apply_action',{_actor:user.id,_action:data.action,_target:data.target,...(data.reason?{_reason:data.reason}:{}),...(data.expires?{_expires:data.expires}:{})});
  if(r.error)throw new Error(r.error.message);
  let warning:string|null=null;
  if(data.action==='ban_user'||data.action==='unban_user') {
    const duration=data.action==='unban_user'?'none':data.expires?`${Math.max(1,Math.ceil((Date.parse(data.expires)-Date.now())/1000))}s`:'876000h';
    const changed=await admin.auth.admin.updateUserById(data.target,{ban_duration:duration});
    if(changed.error)warning='Backend restrictions are active; authentication session invalidation will need retrying.';
  }
  if(data.action.startsWith('delete_'))await cleanupStorage(admin);
  return {ok:true,warning};
});
export const adminChangePassword=createServerFn({method:'POST'}).inputValidator(adminPasswordSchema).handler(async({data})=>{
  const {requireAdmin,authClient}=await import('./admin.server');const {admin,user,session}=await requireAdmin();
  if(!user.email)throw new Error('Administrator account unavailable');
  const checked=await authClient().auth.signInWithPassword({email:user.email,password:data.currentPassword});
  if(checked.error)throw new Error('Current password is incorrect');
  const changed=await admin.auth.admin.updateUserById(user.id,{password:data.password});if(changed.error)throw new Error('Could not change password');
  const log=await admin.from('admin_audit_logs').insert({admin_id:user.id,action:'password_change',target_id:user.id});if(log.error)throw new Error('Could not record password change');
  await session.clear();return {ok:true};
});
export const adminRetryCleanup=createServerFn({method:'POST'}).handler(async()=>{const {requireAdmin,cleanupStorage}=await import('./admin.server');const {admin}=await requireAdmin();await cleanupStorage(admin);return {ok:true};});