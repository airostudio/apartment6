export const metadata = { robots: 'noindex' };

export default function AdminLayout({ children }) {
  return (
    <html lang="en">
      <body className="admin-body">{children}</body>
    </html>
  );
}
