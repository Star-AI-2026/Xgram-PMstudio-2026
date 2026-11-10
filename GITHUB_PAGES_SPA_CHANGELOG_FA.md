# اصلاح نسخه SPA برای GitHub Pages

این نسخه برای انتشار پیام‌رسان Xgram به‌صورت React SPA روی GitHub Pages آماده شده است.

## تغییرات

- مسیرهای فعال پنل مدیریت از `src/routes` خارج و در `legacy-admin-routes` نگهداری شده‌اند تا توابع `createServerFn` وارد بسته مرورگر نشوند.
- ورودی‌های سروری TanStack Start (`src/start.ts` و `src/server.ts`) از ورودی فعال برنامه خارج و در `legacy-admin-routes/infrastructure` نگهداری شده‌اند.
- `src/routeTree.gen.ts` فقط مسیرهای عادی پیام‌رسان را ثبت می‌کند.
- ورودی اصلی همچنان `src/main.tsx` است و با React DOM برنامه را اجرا می‌کند.
- مسیر پایه مخزن در Vite و TanStack Router برابر `/Xgram-PMstudio-2026/` باقی مانده است.
- Workflow از Node.js و npm استفاده می‌کند و به نصب Bun روی رایانه شما نیاز ندارد.
- کش IndexedDB و اتصال مستقیم کاربر به Supabase حفظ شده‌اند.

## انتشار

1. قبل از جایگزینی پوشه پروژه، فایل محلی `.env` را در محل امن دیگری کپی کنید. این فایل عمداً در بسته ZIP قرار نگرفته است.
2. فایل‌های ZIP را در ریشه مخزن جایگزین کنید و `.env` محلی را فقط برای اجرای توسعه، در صورت نیاز، برگردانید. آن را Commit نکنید.
3. در GitHub Repository → Settings → Secrets and variables → Actions این Secrets را تنظیم کنید:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - در صورت استفاده از تماس WebRTC: `VITE_TURN_URLS`، `VITE_TURN_USERNAME` و `VITE_TURN_CREDENTIAL`
4. در Repository → Settings → Pages، گزینه Source را روی `GitHub Actions` قرار دهید.
5. تغییرات را روی شاخه `main` Push کنید و نتیجه Actions را بررسی کنید.

## محدودیت پنل مدیریت

فایل‌های قبلی پنل مدیریت حذف نشده‌اند و در `legacy-admin-routes` و فایل‌های مدیریتی موجود در `src` باقی مانده‌اند؛ اما مسیرهای مدیریت در نسخه عمومی GitHub Pages ثبت نمی‌شوند. GitHub Pages امکان اجرای Server Function یا نگهداری امن کلید Service Role را ندارد. برای فعال‌کردن پنل مدیریت باید آن را روی یک میزبان دارای Backend جداگانه منتشر کرد.

## نکته امنیتی

کلید Supabase Publishable در مرورگر قابل مشاهده است و باید با Row Level Security و Policyهای درست محافظت شود. هرگز `service_role` یا `sb_secret` را در متغیرهای `VITE_` یا در فایل‌های عمومی قرار ندهید.

## وضعیت آزمون

ساختار فایل‌ها و مسیرهای فعال بررسی شده‌اند. اجرای `npm install` در محیط آماده‌سازی به‌دلیل عدم دسترسی شبکه به npm registry کامل نشد؛ بنابراین Build نهایی در این محیط تأیید نشده است. GitHub Actions باید نصب وابستگی‌ها و Build را در محیط خود انجام دهد.
