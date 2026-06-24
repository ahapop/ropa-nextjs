import "./globals.css";

export const metadata = {
  title: "ระบบจัดการบันทึกกิจกรรมการประมวลผลข้อมูลส่วนบุคคล (RoPA)",
  description: "Record of Processing Activities — ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)",
};

export default function RootLayout({ children }){
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
