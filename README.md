# Order Coffee

เว็บรวบรวมออเดอร์เครื่องดื่มสำหรับทีม ใช้งานบนมือถือและแท็บเล็ต มีหน้าผู้สั่ง หลังบ้าน โครงการ รูปเมนู และสรุปออเดอร์

## Local development

```bash
npm install
npm run db:local
npm run dev
```

เปิด `http://127.0.0.1:8787` และเข้าหลังบ้านที่ `#admin` รหัส local คือ `coffee1234`

## Deploy

ใช้ Cloudflare Workers + D1 + R2 โดยตั้งค่า `ADMIN_PASSWORD` และ `ADMIN_SESSION_SECRET` เป็น Worker secrets ก่อน deploy
