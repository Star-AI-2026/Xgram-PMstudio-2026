# راه‌اندازی Xgram روی GitHub Pages

## ساختار این نسخه
- برنامه عمومی به‌صورت React SPA و با TanStack Router اجرا می‌شود؛ GitHub Pages نیازی به سرور Node ندارد.
- وابستگی `@tanstack/react-start` از `package.json` نسخه عمومی حذف شده است.
- فایل‌های سروری و پنل مدیریت، از جمله `createServerFn`، `useServerFn`، Middlewareهای Start، Supabase Service Role client و `cron-auth.ts` از `src/` خارج شده‌اند و در `legacy-admin-routes/` و `legacy-admin-source/` نگهداری می‌شوند.
- پنل مدیریت در نسخه عمومی GitHub Pages فعال نیست؛ برای آن باید Backend جداگانه مستقر شود.
- مسیر پایه در Vite و TanStack Router برابر `/Xgram-PMstudio-2026/` است.
- Workflow فقط از Node.js و npm استفاده می‌کند؛ نصب Bun روی رایانه لازم نیست.
- کش IndexedDB گفتگوها و پیام‌ها و اتصال مستقیم برنامه به Supabase حفظ شده است.

## Secrets ضروری در GitHub
در Repository → Settings → Secrets and variables → Actions این دو Repository secret را اضافه کنید:

- `VITE_SUPABASE_URL` = آدرس پروژه Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` = کلید Publishable/anon پروژه Supabase

کلید `service_role` یا `sb_secret_...` را هرگز در متغیرهای `VITE_`، کد مرورگر یا GitHub Pages قرار ندهید.

اختیاری برای تماس‌های صوتی/تصویری، اگر از TURN استفاده می‌کنید:
- `VITE_TURN_URLS`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

## انتشار
1. از `.env` محلی نسخه پشتیبان بگیرید؛ این فایل عمداً در ZIP نیست.
2. محتویات ZIP را در ریشه مخزن `Star-AI-2026/Xgram-PMstudio-2026` جایگزین کنید. هنگام جایگزینی فایل‌های قدیمی را هم پاک کنید؛ پوشه `.git` و فایل محلی `.env` را نگه دارید.
3. در GitHub → Settings → Pages، گزینه Source را روی `GitHub Actions` قرار دهید.
4. در GitHub Desktop تغییرات را Commit و Push کنید.
5. در GitHub → Actions اجرای `Deploy Xgram to GitHub Pages` را بررسی کنید.

آدرس مورد انتظار:
`https://star-ai-2026.github.io/Xgram-PMstudio-2026/`

## نکات امنیتی و محدودیت‌ها
- فایل `.env` محلی داخل ZIP نیست. آن را Commit نکنید.
- `.env.example` برای راهنمای تنظیمات باقی مانده است.
- کلید Supabase سمت مرورگر باید Publishable/anon باشد و با Row Level Security و Policyهای درست محافظت شود. هرگز `service_role` یا `sb_secret` را در متغیرهای `VITE_` قرار ندهید.
- پنل مدیریت قدیمی در نسخه GitHub Pages اجرا نمی‌شود؛ GitHub Pages امکان اجرای Server Function یا نگهداری امن کلید Service Role را ندارد.
- پیام‌ها و داده‌های اصلی همچنان در Supabase ذخیره می‌شوند؛ IndexedDB فقط Cache محلی هر مرورگر است.
- در محیط آماده‌سازی فعلی npm registry در دسترس نبود، بنابراین Build نهایی از این محیط تأیید نشده است. GitHub Actions باید Build را اجرا کند.
