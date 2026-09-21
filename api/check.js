// api/check.js
// Safe public-network-only website checker.
// Blocks localhost/private ranges to reduce SSRF risk.

const dns = require("dns").promises;
const net = require("net");
const { supabaseRest } = require("./_supabase");

function send(res, status, body) {
  res.status(status).json(body);
}

function isPrivateIPv4(ip) {
  const p = ip.split(".").map(Number);

  if (p.length !== 4 || p.some(Number.isNaN)) {
    return false;
  }

  return (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    p[0] === 0 ||
    p[0] >= 224
  );
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();

  return (
    value === "::1" ||
    value === "::" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:") ||
    value.startsWith("::ffff:127.") ||
    value.startsWith("::ffff:10.") ||
    value.startsWith("::ffff:192.168.")
  );
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);

  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);

  return true;
}

async function assertPublicUrl(raw) {
  const parsed = new URL(raw);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs can be monitored.");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Local/private hostnames cannot be monitored.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("Private IP addresses cannot be monitored.");
    }

    return parsed;
  }

  const addresses = await dns.lookup(hostname, {
    all: true,
    verbatim: true
  });

  if (!addresses.length) {
    throw new Error("Hostname did not resolve.");
  }

  if (addresses.some(entry => isPrivateIp(entry.address))) {
    throw new Error("Hostname resolves to a private/reserved address.");
  }

  return parsed;
}

async function fetchOne(url, method = "HEAD") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "StatusGrid-Monitor/1.0",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8"
      }
    });

    const elapsed = Date.now() - start;

    try {
      if (response.body?.cancel) {
        await response.body.cancel();
      }
    } catch {}

    return {
      response,
      elapsed
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function monitorUrl(initialUrl) {
  let current = (await assertPublicUrl(initialUrl)).href;

  for (let redirects = 0; redirects <= 5; redirects++) {
    let result = await fetchOne(current, "HEAD");

    if ([405, 501].includes(result.response.status)) {
      result = await fetchOne(current, "GET");
    }

    const status = result.response.status;

    if (status >= 300 && status < 400) {
      const location = result.response.headers.get("location");

      if (!location) {
        return {
          status_code: status,
          response_time_ms: result.elapsed,
          is_up: status < 500,
          final_url: current
        };
      }

      const next = new URL(location, current);

      await assertPublicUrl(next.href);
      current = next.href;

      continue;
    }

    return {
      status_code: status,
      response_time_ms: result.elapsed,
      // 4xx still means the server is reachable.
      is_up: status > 0 && status < 500,
      final_url: current
    };
  }

  throw new Error("Too many redirects.");
}

async function recordCheck(siteId, result) {
  const rows = await supabaseRest("checks", {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      site_id: siteId,
      is_up: result.is_up,
      status_code: result.status_code ?? null,
      response_time_ms: result.response_time_ms ?? null,
      error_message: result.error_message ?? null
    })
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  const siteId = String(req.body?.site_id || "").trim();

  if (!siteId) {
    return send(res, 400, { error: "site_id is required." });
  }

  try {
    const sites = await supabaseRest(
      `sites?id=eq.${encodeURIComponent(siteId)}&select=id,name,url&limit=1`
    );

    const site = Array.isArray(sites) ? sites[0] : null;

    if (!site) {
      return send(res, 404, { error: "Website not found." });
    }

    try {
      const result = await monitorUrl(site.url);
      const check = await recordCheck(site.id, result);

      return send(res, 200, {
        ok: true,
        site,
        check
      });
    } catch (monitorError) {
      const check = await recordCheck(site.id, {
        is_up: false,
        status_code: null,
        response_time_ms: null,
        error_message:
          monitorError?.name === "AbortError"
            ? "Request timed out."
            : (monitorError?.message || "Connection failed.")
      });

      return send(res, 200, {
        ok: true,
        site,
        check
      });
    }

  } catch (err) {
    console.error("StatusGrid /api/check:", err);

    return send(res, 500, {
      error: err?.message || "Unable to run uptime check."
    });
  }
};
