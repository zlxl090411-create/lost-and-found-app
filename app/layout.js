import './globals.css';

export const metadata = {
  title: '봉일천고등학교 분실물 게시판',
  description: '봉일천고등학교 분실물 게시판',
  icons: { icon: '/school-logo.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
