import { createFileRoute } from '@tanstack/react-router';
import { AdminConsole } from '@/components/admin/AdminConsole';
import { adminHead } from '@/lib/admin-route';
export const Route=createFileRoute('/_admin/admin_/channels')({head:()=>adminHead('Channels'),component:()=> <AdminConsole section="channels"/>});