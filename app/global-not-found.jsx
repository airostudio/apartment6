import LegacyScripts from '../components/LegacyScripts';

export const metadata = {
  "title": "Page Not Found — Cascade Apartment 6",
  "robots": "noindex"
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
      <link rel={"preconnect"} href={"https://fonts.googleapis.com"} />
      <link rel={"preconnect"} href={"https://fonts.gstatic.com"} crossOrigin="" />
      <link rel="stylesheet" href={"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;700&display=swap"} precedence="default" />
      <link rel="stylesheet" href={"/css/main.css"} precedence="default" />
      <style dangerouslySetInnerHTML={{__html: "\n        .error-page {\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: var(--space-xl);\n            background: var(--color-off-white);\n        }\n        .error-card {\n            background: var(--color-white);\n            border-radius: var(--radius-2xl);\n            padding: var(--space-4xl) var(--space-3xl);\n            max-width: 540px;\n            width: 100%;\n            text-align: center;\n            box-shadow: var(--shadow-xl);\n        }\n        .error-number {\n            font-family: var(--font-heading);\n            font-size: 7rem;\n            font-weight: var(--font-weight-bold);\n            color: var(--color-light);\n            line-height: 1;\n            margin-bottom: var(--space-md);\n            letter-spacing: -4px;\n        }\n        .error-title {\n            font-size: var(--font-size-2xl);\n            color: var(--color-darker);\n            margin-bottom: var(--space-md);\n        }\n        .error-text {\n            font-size: var(--font-size-base);\n            color: var(--color-gray);\n            line-height: var(--line-height-relaxed);\n            margin-bottom: var(--space-2xl);\n        }\n        .error-actions {\n            display: flex;\n            gap: var(--space-md);\n            justify-content: center;\n            flex-wrap: wrap;\n        }\n    "}} />
{" "}
<div className="error-page">{" "}<div className="error-card">{" "}<div className="error-number">{"404"}</div>{" "}<h1 className="error-title">{"Page not found"}</h1>{" "}<p className="error-text">{" The page you're looking for doesn't exist or may have been moved. Let's get you back to finding your perfect stay. "}</p>{" "}<div className="error-actions">{" "}<a href="/" className="btn btn--primary btn--lg">{"Go Home"}</a>{" "}<a href="/property" className="btn btn--outline btn--lg">{"View Apartment"}</a>{" "}</div>{" "}</div>{" "}</div>
{" "}
      <LegacyScripts srcs={[]} />
      </body>
    </html>
  );
}
