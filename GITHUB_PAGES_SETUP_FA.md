# راه‌اندازی Xgram روی GitHub Pages

## چه چیزی در این نسخه تغییر کرده؟
- کد و مسیرهای پنل مدیریت از این بستهٔ قابل‌اشتراک حذف شده‌اند.
- افکت‌های Blur و Liquid Glass نیز از رابط کاربری این نسخه حذف شده‌اند.
- پیام‌رسان اصلی با React + TanStack Router و Supabase از داخل مرورگر اجرا می‌شود.
- مسیر پایه مخزن در Vite و Router روی `/Xgram-PMstudio-2026/` تنظیم است.
- Workflow فقط از Node.js و npm استفاده می‌کند؛ نصب Bun روی رایانه لازم نیست.
- فایل `404.html` از `index.html` ساخته می‌شود تا Refresh مسیرهای داخلی GitHub Pages کار کند.
- کش IndexedDB گفتگوها و پیام‌ها حفظ شده است.

## Secrets ضروری در GitHub
در Repository → Settings → Secrets and variables → Actions این دو Repository secret را اضافه کنید:

- `VITE_SUPABASE_URL` = آدرس پروژه Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` = کلید Publishable/anon پروژه Supabase

کلید `service_role` یا `sb_secret_...` را هرگز در متغیرهای `VITE_`، کد مرورگر یا GitHub Pages قرار ندهید.


## انتشار
1. قبل از جایگزینی، فایل `.env` محلی را در محل امنی کپی کنید؛ این فایل عمداً در ZIP نیست. سپس محتویات ZIP را در ریشه مخزن `Star-AI-2026/Xgram-PMstudio-2026` جایگزین کنید و `.env` را فقط برای اجرای محلی برگردانید؛ آن را Commit نکنید.
2. Commit و Push را روی شاخه `main` انجام دهید.
3. در GitHub → Actions اجرای `Deploy Xgram to GitHub Pages` را بررسی کنید.

آدرس مورد انتظار:
`https://star-ai-2026.github.io/Xgram-PMstudio-2026/`

## نکات امنیتی و محدودیت‌ها
- فایل محلی `.env` عمداً داخل ZIP قرار نگرفته است. آن را در کامپیوتر خود نگه دارید، اما در GitHub Commit نکنید.
- `.env.example` برای راهنمای تنظیمات باقی مانده است.
- کلید Supabase سمت مرورگر باید Publishable/anon باشد؛ کلید محرمانه یا Service Role نباید منتشر شود.
- این بسته شامل پنل مدیریت یا کدهای سروری مدیریتی نیست. نقش‌های مالک/مدیر درون گروه‌ها برای مدیریت خود گروه‌ها حفظ شده‌اند.
- پیام‌ها و داده‌های اصلی همچنان در Supabase ذخیره می‌شوند؛ IndexedDB فقط Cache محلی هر مرورگر است.
- Build نهایی در این محیط تأیید نشده است؛ نصب وابستگی‌ها در محیط اجرا به پایان نرسید. پس از Push، نتیجه GitHub Actions را بررسی کنید.
