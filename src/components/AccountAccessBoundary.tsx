import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { activeBan } from '@/lib/account-ban';
import { XgramLogo } from '@/components/XgramLogo';

export function AccountAccessBoundary({children}:{children:ReactNode}) {
  const {user,signOut}=useAuth();const {language}=useI18n();
  const state=useQuery({queryKey:['account-access',user?.id],enabled:Boolean(user),queryFn:async()=>{if(!user)return null;const r=await supabase.from('account_bans').select('reason,banned_at,expires_at,revoked_at').eq('user_id',user.id).maybeSingle();if(r.error)throw r.error;return r.data;},refetchInterval:5000});
  if(!activeBan(state.data))return children;
  const fa=language==='fa';
  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md text-center"><div className="mb-8 flex justify-center"><XgramLogo size={40} withWordmark/></div><Ban className="mx-auto mb-5 size-10 text-destructive"/><h1 className="text-2xl font-semibold">{fa?'حساب شما مسدود شده است':'Your account is banned'}</h1><p className="mt-4 break-words text-muted-foreground">{state.data?.reason}</p><p className="mt-3 text-sm text-muted-foreground">{state.data?.expires_at?(fa?'پایان محدودیت: ':'Restriction ends: ')+new Date(state.data.expires_at).toLocaleString(fa?'fa':'en'):(fa?'مسدودسازی دائمی':'Permanent ban')}</p><Button variant="outline" className="mt-7" onClick={()=>void signOut()}>{fa?'خروج از حساب':'Sign out'}</Button></div></main>;
}