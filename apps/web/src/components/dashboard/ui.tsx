import Link from "next/link";
import type { ComponentProps, CSSProperties, PropsWithChildren } from "react";

type BtnVariant = "primary" | "secondary";

export function BtnLink({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  const classes = [
    "btn",
    variant === "secondary" ? "btn-secondary" : "btn-primary",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}

export const card: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: "1.25rem",
  marginBottom: "1rem",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

export const btnClass = "btn btn-primary";

export const btn: CSSProperties = {
  background: "var(--brand-primary)",
  color: "#fff",
  border: "none",
  borderRadius: 9999,
  padding: "10px 20px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.95rem",
};

export const input: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: "1rem",
  marginTop: 4,
};

export function PageShell({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "var(--dk)", fontSize: "1.75rem" }}>{title}</h1>
        {subtitle && (
          <p style={{ color: "#666", marginTop: 4, fontSize: "0.95rem" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <label style={{ display: "block", marginBottom: 14, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}
