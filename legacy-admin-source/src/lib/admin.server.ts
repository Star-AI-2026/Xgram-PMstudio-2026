import { createClient } from '@supabase/supabase-js';
import { useSession, setResponseHeader, getRequestHeader } from '@tanstack/react-start/server';

export async function adminSession() {
  const password=process.env['XGRAM_ADMIN_SESSION_SECRET'];
  if(!password) throw new Error('Administrator setup is not configured');
  setResponseHeader('Cache-Control','no-store');
  return useSession<{accessToken:string;refreshToken:string;userId:string}>({password,name:'xgram-admin',maxAge:86400,cookie:{httpOnly:true,sameSite:'strict',secure:process.env['NODE_ENV']==='production',path:'/'}});
}
export function authClient() {
  const url=process.env['SUPABASE_URL'];
  const key=process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'];
  if(!url||!key) throw new Error('Authentication is unavailable');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
}
export async function requireAdmin() {
  const session=await adminSession();
  if(!session.data.accessToken) throw new Error('Administrator sign-in required');
  const client=authClient();
  let result=await client.auth.getUser(session.data.accessToken);
  if(result.error && session.data.refreshToken) {
    const refreshed=await client.auth.refreshSession({refresh_token:session.data.refreshToken});
    if(refreshed.data.session){await session.update({accessToken:refreshed.data.session.access_token,refreshToken:refreshed.data.session.refresh_token,userId:refreshed.data.session.user.id}); result=await client.auth.getUser(refreshed.data.session.access_token);}
  }
  if(result.error || !result.data.user || result.data.user.id!==session.data.userId) {await session.clear();throw new Error('Administrator sign-in required');}
  // Verify the role as the authenticated identity before loading privileged access.
  const token=session.data.accessToken;
  const refreshToken=session.data.refreshToken;
  if(!token||!refreshToken)throw new Error('Administrator sign-in required');
  const scoped=authClient();
  await scoped.auth.setSession({access_token:token,refresh_token:refreshToken});
  const role=await scoped.from('user_roles').select('role').eq('user_id',result.data.user.id).eq('role','super_admin').maybeSingle();
  if(role.error||!role.data) throw new Error('Forbidden');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  return {admin:supabaseAdmin,user:result.data.user,session};
}
export async function loginAdmin(username:string,password:string) {
  const session=await adminSession();
  const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
  // Global identity bucket also bounds spoofed-IP/distributed attempts; IP bucket bounds other identities.
  const ip=getRequestHeader('cf-connecting-ip') ?? 'shared';
  const identity=process.env['XGRAM_ADMIN_USERNAME'];
  if(!identity) throw new Error('Administrator setup is not configured');
  for(const key of ['admin-global',`ip:${ip}`]) {
    const limit=await admin.rpc('admin_login_attempt',{_key:key});
    if(limit.error) throw new Error('Login protection unavailable');
    if(!limit.data) throw new Error('Too many attempts. Try again in 15 minutes.');
  }
  if(username!==identity) throw new Error('Invalid administrator credentials');
  const email='xgram.superadmin@app.local';
  const roles=await admin.from('user_roles').select('user_id').eq('role','super_admin').maybeSingle();
  if(roles.error) throw new Error('Administrator setup unavailable');
  if(!roles.data) {
    const initial=process.env['XGRAM_ADMIN_INITIAL_PASSWORD'];
    if(!initial) throw new Error('Administrator setup is not configured');
    // Provision only after validating the initial secret, never reset an existing account password.
    if(password!==initial) throw new Error('Invalid administrator credentials');
    const created=await admin.auth.admin.createUser({email,password:initial,email_confirm:true,user_metadata:{username:'xgram_admin',display_name:'Xgram Administrator'}});
    if(created.error||!created.data.user) throw new Error('Administrator provisioning failed');
    const assigned=await admin.from('user_roles').insert({user_id:created.data.user.id,role:'super_admin'});
    if(assigned.error) throw new Error('Administrator provisioning failed');
  }
  const signed=await authClient().auth.signInWithPassword({email,password});
  if(signed.error||!signed.data.session) throw new Error('Invalid administrator credentials');
  const role=await admin.from('user_roles').select('role').eq('user_id',signed.data.user.id).eq('role','super_admin').maybeSingle();
  if(role.error||!role.data) throw new Error('Forbidden');
  const log=await admin.from('admin_audit_logs').insert({admin_id:signed.data.user.id,action:'admin_login',target_label:identity});
  if(log.error) throw new Error('Could not record administrator login');
  await session.update({accessToken:signed.data.session.access_token,refreshToken:signed.data.session.refresh_token,userId:signed.data.user.id});
  await admin.from('admin_login_limits').delete().in('key',['admin-global',`ip:${ip}`]);
  return {id:signed.data.user.id,username:identity};
}
export async function cleanupStorage(admin: Awaited<ReturnType<typeof requireAdmin>>['admin']) {
  const queue=await admin.from('admin_storage_cleanup').select('*').limit(100);
  if(queue.error) throw new Error('Storage cleanup unavailable');
  for(const item of queue.data ?? []) {
    const [messages,chats,profiles]=await Promise.all([admin.from('messages').select('id').eq('attachment_url',item.path).limit(1),admin.from('chats').select('id').eq('photo_url',item.path).limit(1),admin.from('profiles').select('id').eq('avatar_url',item.path).limit(1)]);
    if(messages.error||chats.error||profiles.error) continue;
    if(messages.data?.length||chats.data?.length||profiles.data?.length){await admin.from('admin_storage_cleanup').delete().eq('id',item.id);continue;}
    const removed=await admin.storage.from('xgram-media').remove([item.path]);
    if(removed.error)await admin.from('admin_storage_cleanup').update({last_error:'Storage removal failed'}).eq('id',item.id);
    else await admin.from('admin_storage_cleanup').delete().eq('id',item.id);
  }
}