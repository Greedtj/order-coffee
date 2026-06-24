# Order Coffee

เว็บรวบรวมออเดอร์เครื่องดื่มสำหรับทีม ใช้งานบนมือถือและแท็บเล็ต มีหน้าผู้สั่ง หลังบ้าน โครงการ ลิงก์รูปเมนู และสรุปออเดอร์ ข้อมูลเก็บใน Google Sheet

- [เว็บไซต์](https://order-coffee.greedtj.workers.dev)
- [หลังบ้าน](https://order-coffee.greedtj.workers.dev/#admin)
- [Google Sheet](https://docs.google.com/spreadsheets/d/1aPoFqLUaZ7DLx7kjpf49ZuGFMKpsnEQULEG0PYq-CKI/edit)
- [Apps Script](https://script.google.com/d/1xXHNrInUUjhxy66s0sJyYLj_s5jH7ug5-dlmiIofunxAP74vWDgVSrfX/edit)

## Local development

```bash
npm install
npm run dev
```

เปิด `http://127.0.0.1:8787` และเข้าหลังบ้านที่ `#admin`

## Deploy

Google Apps Script ใน `apps-script/` เชื่อมกับชีต `Coffee-Order` และ Cloudflare Worker ทำหน้าที่เป็น API เดียวกับเว็บ ตั้งค่า `APPS_SCRIPT_URL`, `BACKEND_SECRET` และ `ADMIN_SESSION_SECRET` เป็น Worker secrets ก่อน deploy
