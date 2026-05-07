# My Personal Hub Frontend

Frontend của hệ thống My Personal Hub, xây bằng Vue 3 và Vite.

## Stack

- Vue 3
- Vue Router
- Vuex
- Ant Design Vue
- Axios
- Vite

## Môi trường

- Node.js `20.19.0+`

Tạo `.env` từ `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Ví dụ production:

```env
VITE_API_BASE_URL=https://api.your-domain.com
```

## Chạy local

```bash
npm install
npm run dev
```

## Build production

```bash
npm run build
```

## Ghi chú

- Frontend không còn phụ thuộc Node/Express backend cũ
- Router đã lazy-load để giảm tải ban đầu
- API origin được cấu hình hoàn toàn qua biến môi trường
