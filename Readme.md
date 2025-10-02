Để chạy backend hãy:

Cài package:

npm install


Tạo .env (nếu chưa có):

cp .env.example .env


Bật Docker (MySQL + Redis):

npm run docker:up
# kiểm tra container
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"


Bạn nên thấy 2 container chạy: redis và mysql với port 6379/3306 map ra host.

Chạy server (dev, hot-reload):

npm run dev