import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
const email = "sunbired@gmail.com",
  project = "dofus-companion",
  apiKey = "AIzaSyALwDsqYurEhEmQM05tfyXuuJ7bxYTMSNg";
const nonce = randomBytes(32).toString("hex");
let idToken = "",
  origin = "",
  requests = 0;
const google = async (action, body) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error?.message?.split(" : ")[0] || "AUTH_FAILED");
  return data;
};
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><title>Companion · lokale Owner-Einrichtung</title><main><h1>Owner-Konto einrichten</h1><p>Nur lokale Ersteinrichtung für <b>${email}</b> im Projekt <b>${project}</b>. Öffentliche Registrierung bleibt gesperrt. Hier werden keine Administratorrollen vergeben.</p><form id="setup"><label>Neues oder bestehendes persönliches Passwort<input id="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>Passwort wiederholen<input id="confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button name="create">Konto erstellen</button><button name="login" type="button" id="login">Mit vorhandenem Konto anmelden</button></form><button id="verify" disabled>Bestätigungs-E-Mail anfordern</button><button id="check" disabled>E-Mail-Bestätigung prüfen</button><p id="status" role="status">Passwort bleibt ausschließlich im Arbeitsspeicher dieses lokalen Prozesses und wird verschlüsselt an Firebase Authentication übertragen. Schließe diese Einrichtung nach der Bestätigung.</p></main><script src="/setup.js"></script></html>`;
const script = `const token=new URL(location.href).searchParams.get('token');history.replaceState(null,'','/');const status=document.querySelector('#status');async function request(action){try{status.textContent='Wird geprüft …';const password=document.querySelector('#password').value;if(['create','login'].includes(action)&&password!==document.querySelector('#confirm').value)throw Error('Passwörter stimmen nicht überein.');const r=await fetch('/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Setup-Token':token},body:JSON.stringify({password})});const d=await r.json();if(!r.ok)throw Error(d.error);status.textContent=d.message;if(d.signedIn){document.querySelector('#verify').disabled=false;document.querySelector('#check').disabled=false;document.querySelector('#password').value='';document.querySelector('#confirm').value='';}}catch(e){status.textContent=e.message;}}document.querySelector('#setup').onsubmit=e=>{e.preventDefault();request('create')};document.querySelector('#login').onclick=()=>request('login');document.querySelector('#verify').onclick=()=>request('verify');document.querySelector('#check').onclick=()=>request('check');`;
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  const json = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  };
  if (req.headers.host !== new URL(origin).host)
    return json(403, { error: "Ungültiger Host" });
  const url = new URL(req.url, origin);
  if (req.method === "GET") {
    if (url.pathname === "/") {
      if (url.searchParams.get("token") !== nonce)
        return json(403, {
          error: "Bitte den vollständigen lokalen Einrichtungslink verwenden.",
        });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(html);
    }
    if (url.pathname === "/setup.js") {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      return res.end(script);
    }
    if (url.pathname === "/style.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(
        "body{font:16px system-ui;background:#10191b;color:#e2ebeb;max-width:660px;margin:50px auto;padding:24px}label{display:block;margin:20px 0}input{display:block;padding:12px;width:90%}button{padding:12px;margin:8px;background:#b9e76d;border:0;border-radius:8px}p{line-height:1.6}",
      );
    }
    return json(404, { error: "Nicht gefunden" });
  }
  const supplied = Buffer.from(String(req.headers["x-setup-token"] || "")),
    expected = Buffer.from(nonce);
  if (
    req.method !== "POST" ||
    req.headers.origin !== origin ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return json(403, { error: "Lokaler Zugriff erforderlich" });
  if (++requests > 40)
    return json(429, { error: "Zu viele Versuche. Einrichtung neu starten." });
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 8192) throw Error("REQUEST_TOO_LARGE");
    }
    const input = JSON.parse(body || "{}");
    if (["/create", "/login"].includes(url.pathname)) {
      if (
        typeof input.password !== "string" ||
        input.password.length < 12 ||
        input.password.length > 128
      )
        throw Error("Passwort muss 12 bis 128 Zeichen enthalten.");
      const result = await google(
        url.pathname === "/create" ? "signUp" : "signInWithPassword",
        { email, password: input.password, returnSecureToken: true },
      );
      idToken = result.idToken;
      return json(200, {
        signedIn: true,
        message:
          "Angemeldet. Fordere jetzt ausdrücklich die Bestätigungs-E-Mail an und öffne den darin enthaltenen Link.",
      });
    }
    if (!idToken)
      throw Error("Bitte zuerst das eigene Konto erstellen oder anmelden.");
    if (url.pathname === "/verify") {
      await google("sendOobCode", { requestType: "VERIFY_EMAIL", idToken });
      return json(200, {
        message:
          "Bestätigungs-E-Mail wurde durch Firebase angefordert. Anschließend E-Mail-Bestätigung prüfen.",
      });
    }
    if (url.pathname === "/check") {
      const result = await google("lookup", { idToken }),
        user = result.users?.[0];
      if (user?.email !== email || !user.emailVerified)
        throw Error("Die E-Mail ist noch nicht bestätigt.");
      console.log(
        "Owner-Identität durch Firebase bestätigt. UID:",
        user.localId,
      );
      return json(200, {
        message:
          "E-Mail durch Firebase bestätigt. Konto ist bereit für den separat geprüften Owner-Bootstrap. Es wurden noch keine Rollen oder Regeln veröffentlicht.",
      });
    }
    return json(404, { error: "Nicht gefunden" });
  } catch (error) {
    json(400, {
      error:
        error instanceof Error ? error.message : "Einrichtung fehlgeschlagen",
    });
  }
});
server.listen(0, "127.0.0.1", () => {
  origin = `http://127.0.0.1:${server.address().port}`;
  console.log(
    `Lokale Owner-Einrichtung (20 Minuten): ${origin}/?token=${nonce}`,
  );
});
const timeout = setTimeout(
  () =>
    server.close(() => {
      idToken = "";
    }),
  20 * 60 * 1000,
);
timeout.unref();
process.on("SIGINT", () =>
  server.close(() => {
    clearTimeout(timeout);
    idToken = "";
  }),
);
