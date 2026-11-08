# اصلاح نسخه SPA برای GitHub Pages

## تغییرات این بازبینی
- وابستگی `@tanstack/react-start` از `package.json` نسخه عمومی حذف شد؛ این بسته به `@tanstack/start-server-core` و ماژول‌های مجازی مخصوص سرور وابسته بود و برای SPA لازم نیست.
- فایل‌های `admin.functions.ts`، `admin.server.ts`، `admin.schemas.ts`، `admin-route.ts`، `AdminConsole.tsx`، Middlewareهای احراز هویت TanStack Start، `client.server.ts` و `cron-auth.ts` از `src/` خارج و در `legacy-admin-source/` آرشیو شدند.
- فایل‌های ورودی سرور `start.ts` و `server.ts` هم در آرشیو باقی ماندند و دیگر در مسیر Build عمومی نیستند.
- تنظیم مسیرهای TypeScript به قابلیت داخلی Vite منتقل شد؛ افزونه `vite-tsconfig-paths` دیگر لازم نیست. کلاینت Supabase مرورگر فقط از متغیرهای عمومی `VITE_` استفاده می‌کند و fallback به متغیرهای سرور ندارد.
- Workflow پیش از Build بررسی می‌کند که هیچ import یا تابع TanStack Start سمت سرور در `src/` باقی نمانده باشد.
- مسیرهای اصلی پیام‌رسان، ورود کاربران از Supabase، چت‌ها، گروه‌ها، کانال‌ها و کش IndexedDB حفظ شده‌اند.

## محدودیت
این نسخه فقط پیام‌رسان سمت مرورگر است. پنل مدیریت با توابع سروری قدیمی در GitHub Pages قابل اجرا نیست و برای فعال‌سازی آن به Backend جداگانه نیاز است.

## آزمون
ساختار importها و پیکربندی فایل‌ها بررسی شده است، اما اجرای `npm install` در محیط آماده‌سازی به‌دلیل در دسترس نبودن npm registry کامل نشد؛ در نتیجه Build نهایی در این محیط تأیید نشده است.
