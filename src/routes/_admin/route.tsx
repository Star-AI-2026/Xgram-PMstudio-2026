import { createFileRoute,Outlet,redirect } from '@tanstack/react-router';
import { adminIdentity } from '@/lib/admin.functions';
export const Route=createFileRoute('/_admin')({beforeLoad:async()=>{const admin=await adminIdentity();if(!admin)throw redirect({to:'/admin/login'});return {admin};},component:()=> <Outlet/>});