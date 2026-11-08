import { createFileRoute } from '@tanstack/react-router';
import { AdminConsole } from '@/components/admin/AdminConsole';
import { adminHead } from '@/lib/admin-route';
export const Route=createFileRoute('/_admin/admin_/logs')({head:()=>adminHead('Activity Logs'),component:()=> <AdminConsole section="logs"/>});