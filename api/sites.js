// api/sites.js
const { supabaseRest } = require("./_supabase");

function send(res, status, body) {
  res.status(status).json(body);
}

function normalizeUrl(raw) {
  let value = String(raw || "").trim();

  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }

  const parsed = new URL(value);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  parsed.hash = "";
  return parsed.href;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const [sites, checks] = await Promise.all([
        supabaseRest(
          "sites?select=id,name,url,created_at&order=created_at.asc"
        ),
        supabaseRest(
          "checks?select=id,site_id,is_up,status_code,response_time_ms,error_message,checked_at&order=checked_at.desc&limit=200"
        )
      ]);

      return send(res, 200, {
        sites: sites || [],
        checks: checks || []
      });
    }

    if (req.method === "POST") {
      const name = String(req.body?.name || "").trim();

      if (!name) {
        return send(res, 400, { error: "Display name is required." });
      }

      if (name.length > 80) {
        return send(res, 400, { error: "Display name is too long." });
      }

      let url;

      try {
        url = normalizeUrl(req.body?.url);
      } catch (err) {
        return send(res, 400, { error: err.message || "Invalid URL." });
      }

      const rows = await supabaseRest("sites", {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({ name, url })
      });

      return send(res, 201, {
        site: Array.isArray(rows) ? rows[0] : rows
      });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id || "").trim();

      if (!id) {
        return send(res, 400, { error: "Site id is required." });
      }

      await supabaseRest(
        `sites?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal"
          }
        }
      );

      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "Method not allowed." });

  } catch (err) {
    console.error("StatusGrid /api/sites:", err);

    return send(res, 500, {
      error: err?.message || "Unable to access StatusGrid database."
    });
  }
};
