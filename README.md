# ♠ שולחן הפוקר — מדריך התקנה

## מה יש פה
- 🔐 הזדהות עם Google / Facebook
- 🏷️ שם לכל שולחן (ניתן לעריכה)
- 👀 צפייה בזמן אמת לכל אחד (ללא כניסה)
- ✎ עריכת שחקנים וסשנים
- 📊 גרפים: עמודות + קו (ניתן לבחור)
- 💾 שמירה בענן דרך Supabase

---

## שלב 1 — Supabase

1. היכנס ל- [supabase.com](https://supabase.com) וצור חשבון חינמי
2. צור **פרויקט חדש**
3. לך ל- **SQL Editor** והרץ את כל הקוד מ- `src/lib/supabase.js` (החלק שמסומן בהערות)
4. לך ל- **Authentication → Providers** והפעל:
   - **Google** — צריך Google Cloud Console Client ID + Secret
   - **Facebook** — צריך Facebook App ID + Secret
5. הוסף את ה-URL של האתר ל- **Authentication → URL Configuration → Redirect URLs**
6. קבל את המפתחות מ- **Settings → API**:
   - `Project URL`
   - `anon public key`

---

## שלב 2 — הורד והתקן

```bash
# שכפל את הקבצים לתיקייה
cd poker-app

# התקן תלויות
npm install

# צור קובץ .env
cp .env.example .env
# ערוך את .env עם המפתחות שלך מ-Supabase
```

---

## שלב 3 — הרץ מקומית

```bash
npm run dev
# פתח http://localhost:5173
```

---

## שלב 4 — העלה ל-Vercel

1. העלה את הפרויקט ל-GitHub
2. היכנס ל- [vercel.com](https://vercel.com)
3. ייבא את ה-repo
4. הוסף משתני סביבה:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. לחץ Deploy ✅

---

## הגדרת Google OAuth

1. לך ל- [console.cloud.google.com](https://console.cloud.google.com)
2. צור פרויקט → APIs & Services → Credentials
3. צור OAuth 2.0 Client ID
4. Authorized redirect URIs: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
5. הכנס את ה-Client ID + Secret ב-Supabase

## הגדרת Facebook OAuth

1. לך ל- [developers.facebook.com](https://developers.facebook.com)
2. צור App → Facebook Login
3. Valid OAuth Redirect: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. הכנס App ID + Secret ב-Supabase

---

## מבנה הפרויקט

```
src/
  lib/supabase.js       — חיבור לסופרבייס + SQL schema
  hooks/useAuth.jsx     — context הזדהות
  pages/
    AuthPage.jsx        — עמוד התחברות
    HomePage.jsx        — רשימת שולחנות
    TablePage.jsx       — עמוד שולחן ספציפי
  components/
    LiveTab.jsx         — משחק חי + טיימר
    PlayersTab.jsx      — ניהול שחקנים
    SessionsTab.jsx     — סשנים + עריכה
    StatsTab.jsx        — גרפים ו-KPIs
    ExpensesTab.jsx     — הוצאות
```
