import { NextResponse, type NextRequest } from "next/server";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

export function middleware(request: NextRequest) {
  // Allow health checks
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get("dashboard-auth");
  if (authCookie?.value === DASHBOARD_PASSWORD && DASHBOARD_PASSWORD) {
    return NextResponse.next();
  }

  // Allow login API
  if (request.nextUrl.pathname === "/api/login") {
    return NextResponse.next();
  }

  // No password configured = total lockdown (return 403)
  if (!DASHBOARD_PASSWORD) {
    return new NextResponse("Dashboard locked. Set DASHBOARD_PASSWORD env var.", {
      status: 403,
    });
  }

  // Show login page
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sovereign — Login</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:system-ui,-apple-system,sans-serif}
.box{text-align:center;padding:2rem}
h1{font-size:1.2rem;font-weight:600;margin-bottom:1.5rem;letter-spacing:-0.02em}
form{display:flex;gap:0.5rem;justify-content:center}
input{padding:0.5rem 1rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#fff;font-size:0.875rem;outline:none}
input:focus{border-color:rgba(255,255,255,0.3)}
button{padding:0.5rem 1.25rem;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.1);color:#fff;font-size:0.875rem;cursor:pointer}
button:hover{background:rgba(255,255,255,0.15)}
</style></head>
<body><div class="box">
<h1>Sovereign Command Centre</h1>
<form id="f"><input type="password" id="p" placeholder="Password" autofocus required><button type="submit">Enter</button></form>
<div id="err" style="color:#f55;font-size:0.75rem;margin-top:0.75rem"></div>
<script>document.getElementById('f').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('p').value})});if(r.ok)location.reload();else document.getElementById('err').textContent='Wrong password'}</script>
</div></body></html>`,
    {
      status: 401,
      headers: { "Content-Type": "text/html" },
    },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
