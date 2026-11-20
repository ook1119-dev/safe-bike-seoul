import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Safe Bike Seoul",
  description: "따릉이 대여소, 자전거 경로, 과거 사고다발지역, 날씨를 한 화면에서 비교하는 서울 자전거 지도",
};

export const viewport: Viewport = {
  themeColor: "#0f8a5f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
