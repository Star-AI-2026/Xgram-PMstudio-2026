# اصلاح Build نسخه GitHub Pages

- این نسخه فقط از React + TanStack Router در مرورگر استفاده می‌کند.
- وابستگی `@tanstack/react-start` از `package.json` نسخه عمومی حذف شده است.
- کد و مسیرهای پنل مدیریت از بستهٔ قابل‌اشتراک حذف شده‌اند.
- رابط کاربری این نسخه بدون افکت Blur و Liquid Glass است.
- مسیرهای پیام‌رسان، Supabase client، احراز هویت کاربر، چت‌ها و کش IndexedDB در نسخه عمومی نگه داشته شده‌اند.
- `vite-tsconfig-paths` حذف شده و قابلیت بومی `resolve.tsconfigPaths` در Vite فعال است.

در GitHub Actions از Node.js و `npm install` / `npm run build` استفاده کنید. فایل `.env` محرمانه را commit نکنید؛ مقادیر `VITE_SUPABASE_URL` و `VITE_SUPABASE_PUBLISHABLE_KEY` باید از GitHub Actions Secrets تزریق شوند.
